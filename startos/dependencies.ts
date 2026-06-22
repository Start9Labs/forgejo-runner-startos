import { sdk } from './sdk'

// This runner only ever serves the Forgejo on this same device — a hard
// dependency. A box that wants its own CI runs its own runner; we don't reach
// across to a remote forge. Forgejo must be running AND its web interface
// (the 'primary' health check) reachable, since the runner registers and polls
// over Forgejo's HTTP API.
export const setDependencies = sdk.setupDependencies(async ({ effects }) => ({
  forgejo: {
    kind: 'running',
    versionRange: '>=0.0.0:0',
    healthChecks: ['primary'],
  },
}))
