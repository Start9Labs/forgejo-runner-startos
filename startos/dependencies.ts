import { configure } from 'forgejo-startos/startos/actions/configure'
import { i18n } from './i18n'
import { sdk } from './sdk'

// This runner only ever serves the Forgejo on this same device — a hard
// dependency. A box that wants its own CI runs its own runner; we don't reach
// across to a remote forge. Forgejo must be running AND its web interface
// (the 'primary' health check) reachable, since the runner registers and polls
// over Forgejo's HTTP API.
export const setDependencies = sdk.setupDependencies(async ({ effects }) => {
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

  return {
    forgejo: {
      kind: 'running',
      versionRange: '>=16.0.5:1',
      healthChecks: ['primary'],
    },
  }
})
