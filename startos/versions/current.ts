import { VersionInfo, IMPOSSIBLE } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '13.2.1:0',
  releaseNotes: {
    en_US:
      'Updated Forgejo Runner to 13.2.1, a maintenance release refreshing Docker client, gRPC and other dependencies. Full upstream release notes: https://code.forgejo.org/forgejo/runner/releases/tag/v13.2.1',
    es_ES:
      'Forgejo Runner actualizado a 13.2.1, una versión de mantenimiento que actualiza el cliente Docker, gRPC y otras dependencias. Notas completas de la versión original: https://code.forgejo.org/forgejo/runner/releases/tag/v13.2.1',
    de_DE:
      'Forgejo Runner auf 13.2.1 aktualisiert, eine Wartungsversion mit aktualisiertem Docker-Client, gRPC und weiteren Abhängigkeiten. Vollständige Veröffentlichungshinweise des Upstream-Projekts: https://code.forgejo.org/forgejo/runner/releases/tag/v13.2.1',
    pl_PL:
      'Zaktualizowano Forgejo Runner do wersji 13.2.1, wydania konserwacyjnego aktualizującego klienta Docker, gRPC i inne zależności. Pełne informacje o wydaniu projektu źródłowego: https://code.forgejo.org/forgejo/runner/releases/tag/v13.2.1',
    fr_FR:
      'Forgejo Runner mis à jour vers 13.2.1, une version de maintenance qui actualise le client Docker, gRPC et d’autres dépendances. Notes de version complètes du projet amont : https://code.forgejo.org/forgejo/runner/releases/tag/v13.2.1',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
