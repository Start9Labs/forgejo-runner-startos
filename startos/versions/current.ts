import { VersionInfo, IMPOSSIBLE } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '12.13.0:0',
  releaseNotes: {
    en_US: `Updated Forgejo Runner to 12.13.0.

- Adds support for \`case\` statements in the workflow expression interpreter.
- Standardizes the casing of the \`runner.os\` and \`runner.arch\` values.
- Refreshes dependencies.

Full release notes: https://code.forgejo.org/forgejo/runner/releases/tag/v12.13.0`,
    es_ES: `Actualiza Forgejo Runner a 12.13.0.

- Añade compatibilidad con las sentencias \`case\` en el intérprete de expresiones de los flujos de trabajo.
- Normaliza el uso de mayúsculas y minúsculas en los valores de \`runner.os\` y \`runner.arch\`.
- Actualiza las dependencias.

Notas de la versión completas: https://code.forgejo.org/forgejo/runner/releases/tag/v12.13.0`,
    de_DE: `Aktualisiert Forgejo Runner auf 12.13.0.

- Fügt Unterstützung für \`case\`-Anweisungen im Ausdrucksinterpreter der Workflows hinzu.
- Vereinheitlicht die Groß- und Kleinschreibung der Werte von \`runner.os\` und \`runner.arch\`.
- Erneuert die Abhängigkeiten.

Vollständige Versionshinweise: https://code.forgejo.org/forgejo/runner/releases/tag/v12.13.0`,
    pl_PL: `Aktualizuje Forgejo Runner do 12.13.0.

- Dodaje obsługę instrukcji \`case\` w interpreterze wyrażeń przepływów pracy.
- Ujednolica wielkość liter w wartościach \`runner.os\` i \`runner.arch\`.
- Odświeża zależności.

Pełne informacje o wydaniu: https://code.forgejo.org/forgejo/runner/releases/tag/v12.13.0`,
    fr_FR: `Met à jour Forgejo Runner vers 12.13.0.

- Ajoute la prise en charge des instructions \`case\` dans l'interpréteur d'expressions des workflows.
- Uniformise la casse des valeurs \`runner.os\` et \`runner.arch\`.
- Actualise les dépendances.

Notes de version complètes : https://code.forgejo.org/forgejo/runner/releases/tag/v12.13.0`,
  },
  migrations: {
    // Store schema changed (registration token → connection UUID + token). The
    // new credentials can't be derived from the old, so users reconfigure; zod
    // handles the field changes on read, so there's no data transform to run.
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
