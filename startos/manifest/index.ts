import { setupManifest } from '@start9labs/start-sdk'
import { long, short } from './i18n'

export const manifest = setupManifest({
  id: 'forgejo-runner',
  title: 'Forgejo Runner',
  license: 'MIT',
  packageRepo: 'https://github.com/Start9Labs/forgejo-runner-startos',
  upstreamRepo: 'https://code.forgejo.org/forgejo/runner',
  marketingUrl: 'https://forgejo.org/',
  donationUrl: null,
  description: { short, long },
  volumes: ['main'],
  images: {
    main: {
      source: { dockerBuild: { workdir: '.' } },
      arch: ['x86_64', 'aarch64'],
      emulateMissing: false,
    },
  },
  // Run a rootless Podman engine inside the service to sandbox each CI job.
  // It needs both device grants the former nestedRuntime flag bundled:
  // userspaceFilesystems for /dev/fuse (fuse-overlayfs storage) and
  // virtualNetworking for /dev/net/tun (slirp4netns job networking).
  // See start-docs recipe-nested-oci-runtime.
  userspaceFilesystems: true,
  virtualNetworking: true,
})
