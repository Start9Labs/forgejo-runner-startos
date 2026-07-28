import { VersionInfo, IMPOSSIBLE } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '12.13.2:0',
  releaseNotes: {
    en_US: `Updated Forgejo Runner to 12.13.2.

A small bug-fix release: reusable workflows no longer lose \`\${{ inputs.x }}\` values when an \`if:\` condition is evaluated, so steps guarded by an input are skipped or run as intended.

Full upstream release notes: https://code.forgejo.org/forgejo/runner/releases/tag/v12.13.2`,
    es_ES: `Forgejo Runner actualizado a 12.13.2.

Una pequeña versión de corrección: los flujos de trabajo reutilizables ya no pierden los valores de \`\${{ inputs.x }}\` al evaluar una condición \`if:\`, por lo que los pasos condicionados por una entrada se omiten o se ejecutan como corresponde.

Notas de la versión original completas: https://code.forgejo.org/forgejo/runner/releases/tag/v12.13.2`,
    de_DE: `Forgejo Runner auf 12.13.2 aktualisiert.

Eine kleine Fehlerbehebungsversion: Wiederverwendbare Workflows verlieren die Werte von \`\${{ inputs.x }}\` beim Auswerten einer \`if:\`-Bedingung nicht mehr, sodass Schritte mit einer solchen Bedingung wie vorgesehen übersprungen oder ausgeführt werden.

Vollständige Veröffentlichungshinweise des Upstream-Projekts: https://code.forgejo.org/forgejo/runner/releases/tag/v12.13.2`,
    pl_PL: `Zaktualizowano Forgejo Runner do wersji 12.13.2.

Niewielkie wydanie naprawcze: workflowy wielokrotnego użytku nie tracą już wartości \`\${{ inputs.x }}\` podczas obliczania warunku \`if:\`, więc kroki zależne od danych wejściowych są pomijane lub uruchamiane zgodnie z zamierzeniem.

Pełne informacje o wydaniu projektu źródłowego: https://code.forgejo.org/forgejo/runner/releases/tag/v12.13.2`,
    fr_FR: `Forgejo Runner mis à jour vers 12.13.2.

Une petite version corrective : les workflows réutilisables ne perdent plus les valeurs de \`\${{ inputs.x }}\` lors de l'évaluation d'une condition \`if:\`, de sorte que les étapes conditionnées par une entrée sont ignorées ou exécutées comme prévu.

Notes de version complètes du projet amont : https://code.forgejo.org/forgejo/runner/releases/tag/v12.13.2`,
  },
  migrations: {
    // Store schema changed (registration token → connection UUID + token). The
    // new credentials can't be derived from the old, so users reconfigure; zod
    // handles the field changes on read, so there's no data transform to run.
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
