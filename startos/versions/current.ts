import { VersionInfo, IMPOSSIBLE } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '12.12.0:3',
  releaseNotes: {
    en_US: `Installs git in the runner image so workflow steps using \`uses:\` (including actions/checkout) work — they previously failed on a missing git executable. Internal updates (start-sdk 2.0.x).`,
    es_ES: `Instala git en la imagen del ejecutor para que los pasos de flujo de trabajo que usan \`uses:\` (incluido actions/checkout) funcionen; antes fallaban por falta del ejecutable git. Actualizaciones internas (start-sdk 2.0.x).`,
    de_DE: `Installiert git im Runner-Image, damit Workflow-Schritte mit \`uses:\` (einschließlich actions/checkout) funktionieren – zuvor schlugen sie mangels git-Programm fehl. Interne Aktualisierungen (start-sdk 2.0.x).`,
    pl_PL: `Instaluje git w obrazie runnera, aby kroki przepływu pracy używające \`uses:\` (w tym actions/checkout) działały — wcześniej kończyły się błędem z powodu braku programu git. Aktualizacje wewnętrzne (start-sdk 2.0.x).`,
    fr_FR: `Installe git dans l’image du runner pour que les étapes de workflow utilisant \`uses:\` (dont actions/checkout) fonctionnent — elles échouaient auparavant faute de l’exécutable git. Mises à jour internes (start-sdk 2.0.x).`,
  },
  migrations: {
    // Store schema changed (registration token → connection UUID + token). The
    // new credentials can't be derived from the old, so users reconfigure; zod
    // handles the field changes on read, so there's no data transform to run.
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
