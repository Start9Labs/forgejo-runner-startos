#!/bin/bash
exec incus --project "${INCUS_PROJECT:?}" exec "runner:${INCUS_INSTANCE:?}" -T -- socat STDIO TCP:127.0.0.1:2376
