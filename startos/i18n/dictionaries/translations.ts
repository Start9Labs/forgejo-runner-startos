import { LangDict } from './default'

// In-app strings are English-only for now; non-English locales fall back to the
// default dictionary. Marketplace short/long descriptions ARE translated, in
// manifest/i18n.ts. TODO: translate the in-app strings.
export default {} satisfies Record<string, LangDict>
