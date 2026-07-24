import { VersionInfo, IMPOSSIBLE } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '12.13.2:0',
  releaseNotes: {
    en_US: `Updated Forgejo Runner to 12.13.2.

A bug-fix release: corrects \`if:\` conditions that lost their \`\${{ inputs.x }}\` values when a reusable workflow was expanded.

Full release notes: https://code.forgejo.org/forgejo/runner/releases/tag/v12.13.2`,
    es_ES: `Actualiza Forgejo Runner a 12.13.2.

Una versión de corrección de errores: soluciona las condiciones \`if:\` que perdían sus valores \`\${{ inputs.x }}\` al expandir un flujo de trabajo reutilizable.

Notas de la versión completas: https://code.forgejo.org/forgejo/runner/releases/tag/v12.13.2`,
    de_DE: `Aktualisiert Forgejo Runner auf 12.13.2.

Eine Fehlerbehebungsversion: behebt \`if:\`-Bedingungen, die ihre \`\${{ inputs.x }}\`-Werte beim Expandieren eines wiederverwendbaren Workflows verloren.

Vollständige Versionshinweise: https://code.forgejo.org/forgejo/runner/releases/tag/v12.13.2`,
    pl_PL: `Aktualizuje Forgejo Runner do 12.13.2.

Wydanie naprawcze: naprawia warunki \`if:\`, które traciły swoje wartości \`\${{ inputs.x }}\` podczas rozwijania wielokrotnego przepływu pracy.

Pełne informacje o wydaniu: https://code.forgejo.org/forgejo/runner/releases/tag/v12.13.2`,
    fr_FR: `Met à jour Forgejo Runner vers 12.13.2.

Une version de correction de bogues : corrige les conditions \`if:\` qui perdaient leurs valeurs \`\${{ inputs.x }}\` lors de l'expansion d'un workflow réutilisable.

Notes de version complètes : https://code.forgejo.org/forgejo/runner/releases/tag/v12.13.2`,
  },
  migrations: {
    // Store schema changed (registration token → connection UUID + token). The
    // new credentials can't be derived from the old, so users reconfigure; zod
    // handles the field changes on read, so there's no data transform to run.
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
