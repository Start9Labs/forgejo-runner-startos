import { setupManifest } from '@start9labs/start-sdk'
import { dependencyDescription, long, short } from './i18n'

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
    },
  },
  dependencies: {
    forgejo: {
      description: dependencyDescription,
      optional: false,
      metadata: {
        title: 'Forgejo',
        icon: 'https://raw.githubusercontent.com/Start9Labs/forgejo-startos/master/icon.svg',
      },
    },
  },
  // Run a rootless Podman engine inside the service to sandbox each CI job.
  // SDK 1.5.3's nestedRuntime is the combined flag that SDK 2.0 later split
  // into userspaceFilesystems (/dev/fuse) + virtualNetworking (/dev/net/tun,
  // CAP_NET_ADMIN). See start-docs recipe-nested-oci-runtime.
  nestedRuntime: true,
})
