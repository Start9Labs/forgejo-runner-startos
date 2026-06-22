import { VersionInfo, IMPOSSIBLE } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '12.12.0:0',
  releaseNotes: {
    en_US: `Initial Forgejo Runner release for StartOS.`,
    es_ES: `Versión inicial de Forgejo Runner para StartOS.`,
    de_DE: `Erste Forgejo-Runner-Veröffentlichung für StartOS.`,
    pl_PL: `Pierwsze wydanie Forgejo Runner dla StartOS.`,
    fr_FR: `Version initiale de Forgejo Runner pour StartOS.`,
  },
  migrations: {
    // First release of the Forgejo Runner package — nothing to migrate from.
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
