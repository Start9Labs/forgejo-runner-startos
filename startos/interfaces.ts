import { sdk } from './sdk'

// The runner only ever dials out to its forge (and pulls job images); it
// exposes no inbound network interface.
export const setInterfaces = sdk.setupInterfaces(async ({ effects }) => [])
