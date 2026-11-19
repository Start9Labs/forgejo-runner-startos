import { VersionInfo, IMPOSSIBLE } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '13.2.2:0',
  releaseNotes: {
    en_US:
      'Requires StartOS 0.4.2 or later. Updated Forgejo Runner to 13.2.2: reusable workflows triggered by a pull request can no longer write to the cache shared with trusted workflows. Full notes: https://code.forgejo.org/forgejo/runner/releases/tag/v13.2.2',
    es_ES:
      'Requiere StartOS 0.4.2 o posterior. Forgejo Runner actualizado a 13.2.2: los flujos de trabajo reutilizables activados por una pull request ya no pueden escribir en la caché compartida con los flujos de trabajo de confianza. Notas completas: https://code.forgejo.org/forgejo/runner/releases/tag/v13.2.2',
    de_DE:
      'Erfordert StartOS 0.4.2 oder neuer. Forgejo Runner auf 13.2.2 aktualisiert: Durch einen Pull Request ausgelöste wiederverwendbare Workflows können nicht mehr in den Cache schreiben, den vertrauenswürdige Workflows nutzen. Vollständige Hinweise: https://code.forgejo.org/forgejo/runner/releases/tag/v13.2.2',
    pl_PL:
      'Wymaga StartOS 0.4.2 lub nowszego. Zaktualizowano Forgejo Runner do 13.2.2: przepływy pracy wielokrotnego użytku uruchamiane przez pull request nie mogą już zapisywać do pamięci podręcznej współdzielonej z zaufanymi przepływami pracy. Pełne informacje: https://code.forgejo.org/forgejo/runner/releases/tag/v13.2.2',
    fr_FR:
      'Nécessite StartOS 0.4.2 ou une version ultérieure. Forgejo Runner mis à jour vers 13.2.2 : les workflows réutilisables déclenchés par une pull request ne peuvent plus écrire dans le cache partagé avec les workflows de confiance. Notes complètes : https://code.forgejo.org/forgejo/runner/releases/tag/v13.2.2',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
