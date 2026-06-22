import { storeJson } from '../fileModels/store.json'
import { sdk } from '../sdk'

// Seed the store with schema defaults so main.ts and the Configure action
// always read a well-formed object. merge({}) fills missing fields from their
// .catch() defaults and is a no-op on an already-populated store.
export const seedStore = sdk.setupOnInit(async (effects) => {
  await storeJson.merge(effects, {})
})
