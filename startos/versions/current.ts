import { VersionInfo, IMPOSSIBLE } from '@start9labs/start-sdk'
import { sdk } from '../sdk'
import { DATA_DIR, mount } from '../utils'

export const current = VersionInfo.of({
  version: '13.2.0:4',
  releaseNotes: {
    en_US: `- Missing credentials raise a critical Configure task; complete it before starting the runner.
- Replaced Podman with Docker, fixing apt ID mapping. Jobs are privileged and share engine access: only run trusted workflows.
- Nested builds use persistent scratch storage excluded from backups, StartOS DNS, and namespace-local QEMU. Obsolete Podman image caches are removed on upgrade.
- Updated start-sdk to 3.0.6.`,
    es_ES: `- Si faltan credenciales, se crea una tarea crítica Configurar; complétela antes de iniciar el ejecutor.
- Se sustituyó Podman por Docker, corrigiendo la asignación de IDs de apt. Los trabajos son privilegiados y comparten acceso al motor: ejecute solo flujos de trabajo de confianza.
- Las compilaciones anidadas usan almacenamiento temporal persistente excluido de las copias de seguridad, DNS de StartOS y QEMU local al espacio de nombres. Al actualizar se eliminan las cachés de imágenes de Podman obsoletas.
- start-sdk actualizado a 3.0.6.`,
    de_DE: `- Fehlende Zugangsdaten lösen eine kritische Aufgabe „Konfigurieren“ aus; schließen Sie sie vor dem Start ab.
- Podman wurde durch Docker ersetzt, wodurch die ID-Zuordnung für apt korrigiert wird. Jobs sind privilegiert und teilen den Engine-Zugriff: Führen Sie nur vertrauenswürdige Workflows aus.
- Verschachtelte Builds verwenden persistente Arbeitsdaten außerhalb der Sicherungen, StartOS-DNS und namensraumlokales QEMU. Veraltete Podman-Image-Caches werden beim Update entfernt.
- start-sdk auf 3.0.6 aktualisiert.`,
    pl_PL: `- Brak danych uwierzytelniających tworzy krytyczne zadanie Konfiguruj; ukończ je przed uruchomieniem runnera.
- Zastąpiono Podman silnikiem Docker, naprawiając mapowanie ID dla apt. Zadania są uprzywilejowane i współdzielą dostęp do silnika: uruchamiaj tylko zaufane workflowy.
- Zagnieżdżone kompilacje używają trwałego wolumenu roboczego wyłączonego z kopii zapasowych, DNS StartOS i QEMU lokalnego dla przestrzeni nazw. Przy aktualizacji usuwane są stare pamięci podręczne obrazów Podman.
- Zaktualizowano start-sdk do 3.0.6.`,
    fr_FR: `- Sans identifiants, une tâche critique Configurer est créée ; terminez-la avant de démarrer le runner.
- Podman est remplacé par Docker, corrigeant le mappage des identifiants pour apt. Les tâches sont privilégiées et partagent l’accès au moteur : exécutez uniquement des workflows de confiance.
- Les compilations imbriquées utilisent un stockage de travail persistant exclu des sauvegardes, le DNS de StartOS et QEMU local à l’espace de noms. Les anciens caches d’images Podman sont supprimés à la mise à jour.
- start-sdk mis à jour vers 3.0.6.`,
  },
  migrations: {
    up: async ({ effects }) => {
      await sdk.SubContainer.withTemp(
        effects,
        { imageId: 'main' },
        mount,
        'remove-podman-cache',
        (subcontainer) =>
          subcontainer.execFail(
            ['rm', '-rf', `${DATA_DIR}/runner/containers`],
            { user: 'root', timeout: null },
          ),
      )
    },
    down: IMPOSSIBLE,
  },
})
