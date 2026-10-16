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
  volumes: ['main', 'scratch'],
  images: {
    main: {
      source: { dockerBuild: { workdir: '.' } },
      arch: ['x86_64', 'aarch64'],
      emulateMissing: false,
    },
  },
  userspaceFilesystems: true,
})
