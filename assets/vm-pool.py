#!/usr/bin/python3
import json
import os
import signal
import socket
import socketserver
import sys
import threading
import time
import uuid
from dataclasses import asdict, dataclass
from pathlib import Path

MIB = 1024 * 1024
CONTROL = Path('/pool/control.sock')
STATE = Path('/pool/leases.json')
WORKERS = Path('/workers')


class QMP:
    def __init__(self, path):
        self.socket = socket.socket(socket.AF_UNIX)
        self.socket.settimeout(2)
        try:
            self.socket.connect(str(path))
            self.stream = self.socket.makefile('rwb', buffering=0)
            self.read()
            self.execute('qmp_capabilities')
        except Exception:
            if hasattr(self, 'stream'):
                self.stream.close()
            self.socket.close()
            raise

    def read(self):
        data = self.stream.readline(65536)
        if not data or len(data) >= 65536:
            raise RuntimeError('Invalid QMP response')
        return json.loads(data)

    def execute(self, command, arguments=None):
        self.stream.write((json.dumps({'execute': command, 'arguments': arguments or {}}) + '\n').encode())
        while True:
            response = self.read()
            if 'error' in response:
                raise RuntimeError(str(response['error']))
            if 'return' in response:
                return response['return']

    def close(self):
        self.stream.close()
        self.socket.close()


@dataclass
class Lease:
    identity: str
    slot: int
    grant: int = 0
    started: bool = False


class MemoryPool:
    def __init__(self, budget, boot, block, capacity, device, workers=WORKERS, state=STATE):
        if boot <= 0 or block <= 0 or boot % block or budget % block or capacity * boot > budget:
            raise ValueError('Invalid shared guest-memory budget')
        self.budget, self.boot, self.block = budget, boot, block
        self.capacity, self.device = capacity, device
        self.workers, self.state = workers, state
        self.condition = threading.Condition()
        self.stopping = False
        self.leases = {}
        self.saved = self.state.read_text() if self.state.exists() else None
        if self.saved is not None:
            for record in json.loads(self.saved):
                lease = Lease(**record)
                if not self.current(lease):
                    continue
                self.validate(lease.identity, lease.slot)
                if lease.grant < 0 or lease.grant % block:
                    raise ValueError('Invalid recovered memory lease')
                self.leases[lease.identity] = lease

    def validate(self, identity, slot):
        if str(uuid.UUID(identity)) != identity or type(slot) is not int or not 0 <= slot < self.capacity:
            raise ValueError('Invalid worker lease')

    def current(self, lease):
        try:
            return (self.workers / str(lease.slot) / 'lease').read_text().strip() == lease.identity
        except FileNotFoundError:
            return False

    def persist(self):
        payload = json.dumps([asdict(lease) for lease in self.leases.values()])
        if payload == self.saved:
            return
        temporary = self.state.with_suffix('.tmp')
        with temporary.open('w') as output:
            output.write(payload)
            output.flush()
            os.fsync(output.fileno())
        temporary.replace(self.state)
        self.saved = payload

    def endpoint(self, lease):
        endpoint = QMP(self.workers / str(lease.slot) / 'qmp.sock')
        try:
            if endpoint.execute('query-name').get('name') != lease.identity:
                raise RuntimeError('Hypervisor lease identity mismatch')
            return endpoint
        except Exception:
            endpoint.close()
            raise

    def memory(self, endpoint):
        devices = endpoint.execute('query-memory-devices')
        device = next(d['data'] for d in devices if d['type'] == 'virtio-mem' and d['data']['id'] == self.device)
        return device['size'] // MIB

    def request(self, endpoint, grant):
        endpoint.execute('qom-set', {
            'path': '/machine/peripheral/' + self.device,
            'property': 'requested-size',
            'value': (grant - self.boot) * MIB,
        })

    def targets(self):
        ordered = sorted(self.leases.values(), key=lambda lease: lease.slot)
        if not ordered:
            return {}
        share, remainder = divmod(self.budget // self.block, len(ordered))
        return {lease.identity: (share + (index < remainder)) * self.block for index, lease in enumerate(ordered)}

    def reconcile(self):
        with self.condition:
            for identity, lease in list(self.leases.items()):
                if not self.current(lease):
                    del self.leases[identity]
            targets = self.targets()
            for lease in self.leases.values():
                if not lease.started:
                    continue
                endpoint = None
                try:
                    endpoint = self.endpoint(lease)
                    target = min(lease.grant, targets[lease.identity])
                    self.request(endpoint, target)
                    if self.memory(endpoint) <= target - self.boot:
                        lease.grant = target
                except (OSError, ValueError, RuntimeError, StopIteration):
                    pass
                finally:
                    if endpoint:
                        endpoint.close()
            free = self.budget - sum(lease.grant for lease in self.leases.values())
            for lease in sorted(self.leases.values(), key=lambda lease: lease.slot):
                if lease.grant == 0 and free >= self.boot:
                    lease.grant = min(targets[lease.identity], free // self.block * self.block)
                    free -= lease.grant
            self.persist()
            for lease in self.leases.values():
                if lease.started and targets[lease.identity] > lease.grant and free >= self.block:
                    increase = min(targets[lease.identity] - lease.grant, free // self.block * self.block)
                    lease.grant += increase
                    free -= increase
                    self.persist()
            self.condition.notify_all()

    def acquire(self, identity, slot):
        self.validate(identity, slot)
        with self.condition:
            if identity not in self.leases:
                if any(lease.slot == slot for lease in self.leases.values()):
                    raise RuntimeError('Worker already owns a memory lease')
                lease = Lease(identity, slot)
                if not self.current(lease):
                    raise RuntimeError('Worker lease file does not match')
                self.leases[identity] = lease
                self.persist()
            if self.leases[identity].slot != slot:
                raise RuntimeError('Worker does not own memory lease')
            while not self.stopping:
                lease = self.leases.get(identity)
                if lease is None:
                    raise RuntimeError('Memory admission cancelled')
                if lease.grant:
                    return {'memory_mib': lease.grant}
                self.condition.wait(1)
            raise RuntimeError('Memory pool is stopping')

    def started(self, identity, slot):
        self.validate(identity, slot)
        with self.condition:
            lease = self.leases[identity]
            if lease.slot != slot or not lease.grant:
                raise RuntimeError('No memory reservation for this guest')
            endpoint = self.endpoint(lease)
            endpoint.close()
            lease.started = True
            self.persist()
            while not self.stopping:
                endpoint = None
                try:
                    endpoint = self.endpoint(lease)
                    if self.memory(endpoint) >= lease.grant - self.boot:
                        return {'memory_mib': lease.grant}
                finally:
                    if endpoint:
                        endpoint.close()
                self.condition.wait(1)
                if identity not in self.leases:
                    raise RuntimeError('Guest memory lease was released')
            raise RuntimeError('Memory pool is stopping')

    def release(self, identity, slot):
        self.validate(identity, slot)
        with self.condition:
            lease = self.leases.get(identity)
            if lease and lease.slot != slot:
                raise RuntimeError('Worker does not own memory lease')
            self.leases.pop(identity, None)
            self.persist()
            self.condition.notify_all()
        return {}

    def status(self):
        with self.condition:
            return {'budget_mib': self.budget, 'committed_mib': sum(lease.grant for lease in self.leases.values()),
                    'leases': [asdict(lease) for lease in self.leases.values()]}


class RequestHandler(socketserver.StreamRequestHandler):
    def handle(self):
        try:
            payload = self.rfile.readline(4096)
            if not payload or len(payload) >= 4096:
                raise ValueError('Invalid memory-pool request')
            request = json.loads(payload)
            operation = request['operation']
            pool = self.server.pool
            if operation == 'status':
                result = pool.status()
            elif operation in ('acquire', 'started', 'release'):
                result = getattr(pool, operation)(request['identity'], request['slot'])
            else:
                raise ValueError('Unknown memory-pool operation')
            response = {'result': result}
        except Exception as error:
            response = {'error': str(error)}
        try:
            self.wfile.write((json.dumps(response) + '\n').encode())
        except BrokenPipeError:
            pass


class Server(socketserver.ThreadingUnixStreamServer):
    daemon_threads = True


def serve():
    os.umask(0o077)
    CONTROL.parent.mkdir(parents=True, exist_ok=True)
    pool = MemoryPool(int(os.environ['VM_POOL_MEMORY_MB']), int(os.environ['VM_BOOT_MEMORY_MB']),
                      int(os.environ['VM_MEMORY_BLOCK_MB']), int(os.environ['VM_CAPACITY']),
                      os.environ['VM_MEMORY_DEVICE_ID'])
    CONTROL.unlink(missing_ok=True)
    with Server(str(CONTROL), RequestHandler) as server:
        server.pool = pool
        (CONTROL.parent / 'manager.pid').write_text(str(os.getpid()))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        def stop(signum, frame):
            with pool.condition:
                pool.stopping = True
                pool.condition.notify_all()
        signal.signal(signal.SIGTERM, stop)
        signal.signal(signal.SIGINT, stop)
        try:
            while not pool.stopping:
                pool.reconcile()
                time.sleep(.25)
        finally:
            server.shutdown()
            CONTROL.unlink(missing_ok=True)
            (CONTROL.parent / 'manager.pid').unlink(missing_ok=True)


def exchange(connection, operation, identity, slot):
    connection.sendall((json.dumps({'operation': operation, 'identity': identity, 'slot': slot}) + '\n').encode())
    with connection.makefile('rb') as stream:
        payload = stream.readline(65536)
        if not payload:
            raise ConnectionError('Memory controller connection closed')
        response = json.loads(payload)
    if 'error' in response:
        raise RuntimeError(response['error'])
    return response['result']


def client(operation, identity=None, slot=None):
    patience = 30 if operation in ('acquire', 'started') else 0
    deadline = None
    while True:
        try:
            with socket.socket(socket.AF_UNIX) as connection:
                connection.settimeout(10 if operation in ('release', 'status') else None)
                connection.connect(str(CONTROL))
                deadline = None
                return exchange(connection, operation, identity, slot)
        except OSError:
            if deadline is None:
                deadline = time.monotonic() + patience
            if time.monotonic() >= deadline:
                raise
            time.sleep(.25)


if __name__ == '__main__':
    if sys.argv[1:] == ['serve']:
        serve()
    else:
        operation = sys.argv[1]
        print(json.dumps(client(operation, os.environ.get('VM_LEASE'), int(os.environ.get('VM_SLOT', '0')))))
