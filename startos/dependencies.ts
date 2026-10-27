import { configure } from 'forgejo-startos/startos/actions/configure'
import { storeJson } from './fileModels/store.json'
import { i18n } from './i18n'
import { dependencyDescription } from './manifest/i18n'
import { sdk } from './sdk'

// The runner registers and polls over Forgejo's HTTP API, so a local Forgejo
// must be running with its web interface (the 'primary' health check) reachable.
const forgejo = sdk.Dependency.optional('forgejo', {
  description: dependencyDescription,
  metadata: {
    title: 'Forgejo',
    icon: 'https://raw.githubusercontent.com/Start9Labs/forgejo-startos/master/icon.svg',
  },
  versionRange: '>=16.0.5:1',
  kind: 'running',
  healthChecks: ['primary'],
  enabled: async ({ effects }) =>
    !(await storeJson.read((s) => s.remoteUrl).const(effects)),
}).withInit(async (effects) => {
  await sdk.action.createTask(effects, 'forgejo', configure, 'critical', {
    input: {
      kind: 'partial',
      accept: [{ FORGEJO__actions__ENABLED: true }],
      set: { FORGEJO__actions__ENABLED: true },
    },
    reason: i18n(
      'Forgejo Actions must be enabled for Forgejo Runner to run jobs.',
    ),
    when: { condition: 'input-not-matches', once: false },
  })
})

export const dependencies = sdk.Dependencies.of().addDependency(forgejo)
