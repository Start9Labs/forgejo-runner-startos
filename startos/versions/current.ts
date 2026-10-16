import { VersionInfo, IMPOSSIBLE } from '@start9labs/start-sdk'
import { sdk } from '../sdk'
import { DATA_DIR, SCRATCH_DIR, mount } from '../utils'

export const current = VersionInfo.of({
  version: '13.2.0:5',
  releaseNotes: {
    en_US: `- Missing credentials raise a critical Configure task; complete it before starting the runner.
- Replaced Podman with Docker, fixing apt ID mapping. The existing registration becomes an unprivileged runner without an engine socket.
- For privileged jobs, enable Configure Privileged Runner with a separate repository/organization-scoped registration and use runs-on: startos-build. The privileged runner is disabled by default.
- The runners have separate engines, credentials, and storage, but share the outer StartOS service boundary. Restrict the privileged runner to trusted repositories; labels are not access control.
- Nested builds use persistent scratch storage excluded from backups, StartOS DNS, and service-local QEMU. Old unpartitioned engine caches are removed on upgrade.
- Updated start-sdk to 3.0.6.`,
    es_ES: `- Si faltan credenciales, se crea una tarea crítica Configurar; complétela antes de iniciar el ejecutor.
- Se sustituyó Podman por Docker, corrigiendo la asignación de IDs de apt. El registro existente pasa a ser un ejecutor sin privilegios ni socket del motor.
- Para trabajos privilegiados, habilite Configurar ejecutor privilegiado con un registro separado limitado a un repositorio u organización y use runs-on: startos-build. Está desactivado por defecto.
- Los ejecutores tienen motores, credenciales y almacenamiento separados, pero comparten el límite exterior del servicio StartOS. Restrinja el ejecutor privilegiado a repositorios de confianza; las etiquetas no controlan el acceso.
- Las compilaciones anidadas usan almacenamiento temporal persistente excluido de las copias de seguridad, DNS de StartOS y QEMU local al servicio. Al actualizar se eliminan las antiguas cachés sin particionar.
- start-sdk actualizado a 3.0.6.`,
    de_DE: `- Fehlende Zugangsdaten lösen eine kritische Aufgabe „Konfigurieren“ aus; schließen Sie sie vor dem Start ab.
- Podman wurde durch Docker ersetzt und die ID-Zuordnung für apt korrigiert. Die bestehende Registrierung wird unprivilegiert und erhält keinen Engine-Socket.
- Für privilegierte Jobs verwenden Sie Privilegierten Runner konfigurieren mit einer separaten Repository-/Organisationsregistrierung und verwenden runs-on: startos-build. Der privilegierte Runner ist standardmäßig deaktiviert.
- Die Runner haben separate Engines, Zugangsdaten und Speicher, teilen jedoch die äußere StartOS-Dienstgrenze. Beschränken Sie den privilegierten Runner auf vertrauenswürdige Repositories; Labels sind keine Zugriffskontrolle.
- Verschachtelte Builds verwenden persistente Arbeitsdaten außerhalb der Sicherungen, StartOS-DNS und dienstlokales QEMU. Alte ungetrennte Engine-Caches werden beim Update entfernt.
- start-sdk auf 3.0.6 aktualisiert.`,
    pl_PL: `- Brak danych uwierzytelniających tworzy krytyczne zadanie Konfiguruj; ukończ je przed uruchomieniem runnera.
- Zastąpiono Podman silnikiem Docker i naprawiono mapowanie ID dla apt. Istniejąca rejestracja staje się nieuprzywilejowana i nie otrzymuje gniazda silnika.
- Do zadań uprzywilejowanych użyj akcji Konfiguruj uprzywilejowanego runnera z osobną rejestracją ograniczoną do repozytorium lub organizacji i użyj runs-on: startos-build. Uprzywilejowany runner jest domyślnie wyłączony.
- Runnery mają osobne silniki, dane uwierzytelniające i pamięć, ale współdzielą zewnętrzną granicę usługi StartOS. Ogranicz uprzywilejowanego runnera do zaufanych repozytoriów; etykiety nie kontrolują dostępu.
- Zagnieżdżone kompilacje używają trwałego wolumenu roboczego wyłączonego z kopii zapasowych, DNS StartOS i QEMU lokalnego dla usługi. Przy aktualizacji usuwane są stare niepodzielone pamięci podręczne silnika.
- Zaktualizowano start-sdk do 3.0.6.`,
    fr_FR: `- Sans identifiants, une tâche critique Configurer est créée ; terminez-la avant de démarrer le runner.
- Podman est remplacé par Docker, corrigeant le mappage des identifiants pour apt. L’inscription existante devient non privilégiée, sans socket du moteur.
- Pour les tâches privilégiées, activez Configurer le runner privilégié avec une inscription distincte limitée à un dépôt ou une organisation et utilisez runs-on: startos-build. Il est désactivé par défaut.
- Les runners ont des moteurs, identifiants et stockages distincts, mais partagent la limite extérieure du service StartOS. Limitez le runner privilégié aux dépôts de confiance ; les étiquettes ne contrôlent pas les accès.
- Les compilations imbriquées utilisent un stockage persistant exclu des sauvegardes, le DNS de StartOS et QEMU local au service. Les anciens caches non séparés sont supprimés à la mise à jour.
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
            [
              'sh',
              '-ec',
              `mkdir -p ${DATA_DIR}/unprivileged/runner
if [ -f ${DATA_DIR}/runner/rejected-uuid ]; then
  mv ${DATA_DIR}/runner/rejected-uuid ${DATA_DIR}/unprivileged/runner/rejected-uuid
fi
rm -rf ${DATA_DIR}/runner ${SCRATCH_DIR}/docker ${SCRATCH_DIR}/jobs`,
            ],
            { user: 'root', timeout: null },
          ),
      )
    },
    down: IMPOSSIBLE,
  },
})
