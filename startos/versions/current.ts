import { VersionInfo, IMPOSSIBLE } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '12.13.1:1',
  releaseNotes: {
    en_US: `Updated Forgejo Runner to 12.13.1.

- Adds support for \`case\` statements in the workflow expression interpreter.
- Standardizes the casing of the \`runner.os\` and \`runner.arch\` values.
- 12.13.1 is a bug-fix release.
- Migrates the package to start-sdk 2.0 (requires StartOS 0.4.0-beta.10 or later).

Full release notes: https://code.forgejo.org/forgejo/runner/releases/tag/v12.13.1`,
    es_ES: `Actualiza Forgejo Runner a 12.13.1.

- Añade compatibilidad con las sentencias \`case\` en el intérprete de expresiones de los flujos de trabajo.
- Normaliza el uso de mayúsculas y minúsculas en los valores de \`runner.os\` y \`runner.arch\`.
- La versión 12.13.1 es una versión de corrección de errores.
- Migra el paquete a start-sdk 2.0 (requiere StartOS 0.4.0-beta.10 o posterior).

Notas de la versión completas: https://code.forgejo.org/forgejo/runner/releases/tag/v12.13.1`,
    de_DE: `Aktualisiert Forgejo Runner auf 12.13.1.

- Fügt Unterstützung für \`case\`-Anweisungen im Ausdrucksinterpreter der Workflows hinzu.
- Vereinheitlicht die Groß- und Kleinschreibung der Werte von \`runner.os\` und \`runner.arch\`.
- 12.13.1 ist eine Fehlerbehebungsversion.
- Stellt das Paket auf start-sdk 2.0 um (erfordert StartOS 0.4.0-beta.10 oder neuer).

Vollständige Versionshinweise: https://code.forgejo.org/forgejo/runner/releases/tag/v12.13.1`,
    pl_PL: `Aktualizuje Forgejo Runner do 12.13.1.

- Dodaje obsługę instrukcji \`case\` w interpreterze wyrażeń przepływów pracy.
- Ujednolica wielkość liter w wartościach \`runner.os\` i \`runner.arch\`.
- Wersja 12.13.1 to wydanie naprawcze.
- Przenosi pakiet na start-sdk 2.0 (wymaga StartOS 0.4.0-beta.10 lub nowszego).

Pełne informacje o wydaniu: https://code.forgejo.org/forgejo/runner/releases/tag/v12.13.1`,
    fr_FR: `Met à jour Forgejo Runner vers 12.13.1.

- Ajoute la prise en charge des instructions \`case\` dans l'interpréteur d'expressions des workflows.
- Uniformise la casse des valeurs \`runner.os\` et \`runner.arch\`.
- La version 12.13.1 est une version de correction de bogues.
- Fait passer le paquet à start-sdk 2.0 (nécessite StartOS 0.4.0-beta.10 ou une version ultérieure).

Notes de version complètes : https://code.forgejo.org/forgejo/runner/releases/tag/v12.13.1`,
  },
  migrations: {
    // Store schema changed (registration token → connection UUID + token). The
    // new credentials can't be derived from the old, so users reconfigure; zod
    // handles the field changes on read, so there's no data transform to run.
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
