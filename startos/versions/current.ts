import { VersionInfo, IMPOSSIBLE } from '@start9labs/start-sdk'
import { sdk } from '../sdk'
import { DATA_DIR, SCRATCH_DIR, mount } from '../utils'

export const current = VersionInfo.of({
  version: '13.2.0:5',
  releaseNotes: {
    en_US: `- Missing credentials raise a critical Configure task; complete it before starting the runner.
- Replaced Podman with Docker, fixing apt ID mapping.
- One persistent runner registration serves all jobs. Virtualized jobs each receive a fresh disposable VM, including concurrent jobs.
- VMs boot only after job assignment; idle slots allocate no guest. Active guests share one RAM pool, borrowing unused capacity and waiting for confirmed reclamation before more memory is granted.
- Virtualization defaults on when KVM is available. Without KVM the option is off and disabled; container mode remains available and shares the StartOS kernel. VM failures never silently select container mode.
- Guest Docker APIs use per-VM mutual TLS. The runner is built with action-source path containment and keeps its registration outside the guest.
- Guest images are pinned, verified and prepared once. Job disks and engine caches are excluded from backups; old engine caches are removed on upgrade.
- Workflow labels are routing, not access control; use an appropriately scoped persistent registration.
- Routine empty job polls are debug-only; job pickup and polling errors remain visible.
- Isolated action-source caches per job to prevent abandoned Git locks from blocking later jobs.
- VM image download and installation report Loading; idle job slots report Waiting separately from controller readiness.
- Balanced hotplugged guest RAM between kernel and movable zones to prevent kernel-allocation OOMs with free RAM; unchanged memory targets no longer generate repeated device notifications.
- Install the public OS root CA in workflow job containers and Node action trust, and route Forgejo's local hostnames through the OS bridge without disabling TLS verification.
- Corrected the upstream license to GPL-3.0-or-later.
- Updated start-sdk to 3.0.6.`,
    es_ES: `- Si faltan credenciales, se crea una tarea crítica Configurar; complétela antes de iniciar el ejecutor.
- Se sustituyó Podman por Docker, corrigiendo la asignación de IDs de apt.
- Un único registro persistente atiende todos los trabajos. Cada trabajo virtualizado recibe una máquina virtual desechable propia, también al ejecutarse en paralelo.
- Las máquinas arrancan tras asignar un trabajo; las instancias inactivas no mantienen invitados. Los invitados activos comparten una reserva de RAM y esperan a confirmar su recuperación antes de conceder más memoria.
- La virtualización está activada por defecto si hay KVM. Sin KVM, la opción queda desactivada y bloqueada; los contenedores siguen disponibles y comparten el núcleo de StartOS. Un fallo de VM nunca cambia de modo automáticamente.
- Las API Docker de invitados usan TLS mutuo por VM. El ejecutor limita las rutas de origen de acciones y mantiene su registro fuera del invitado.
- Las imágenes de invitados están fijadas, verificadas y se preparan una sola vez. Los discos de trabajos y las cachés se excluyen de las copias de seguridad; al actualizar se eliminan las cachés antiguas del motor.
- Las etiquetas no controlan el acceso; use un registro persistente con alcance adecuado.
- Los sondeos sin trabajos solo aparecen en depuración; las asignaciones y los errores siguen visibles.
- Cachés de código de acciones separadas por trabajo para evitar bloqueos de Git abandonados.
- La preparación de la imagen indica Cargando; los trabajos inactivos indican En espera sin bloquear el ejecutor.
- La memoria añadida equilibra las zonas del núcleo y móviles para evitar falta de memoria del núcleo con RAM libre; los objetivos sin cambios no repiten notificaciones.
- Se instala la CA pública del sistema en los trabajos y en Node, y los nombres locales de Forgejo se enrutan por el puente del sistema sin desactivar TLS.
- Licencia corregida a GPL-3.0-or-later.
- start-sdk actualizado a 3.0.6.`,
    de_DE: `- Fehlende Zugangsdaten lösen eine kritische Aufgabe „Konfigurieren“ aus; schließen Sie sie vor dem Start ab.
- Podman wurde durch Docker ersetzt und die ID-Zuordnung für apt korrigiert.
- Eine persistente Runner-Registrierung bedient alle Jobs. Jeder virtualisierte Job erhält eine eigene wegwerfbare VM, auch bei paralleler Ausführung.
- VMs starten erst nach Jobzuweisung; inaktive Slots halten keinen Gast. Aktive Gäste teilen ein RAM-Budget und nutzen freie Kapazität. Weitere Zuweisungen warten auf bestätigte Speicherrückgabe.
- Virtualisierung ist mit KVM standardmäßig aktiv. Ohne KVM ist die Option deaktiviert und gesperrt; Container teilen den StartOS-Kernel. VM-Fehler wechseln niemals automatisch den Modus.
- Gast-Docker-APIs nutzen gegenseitiges TLS pro VM. Aktionsquellpfade sind begrenzt; die Registrierung bleibt außerhalb des Gasts.
- Gast-Images sind festgelegt, geprüft und werden einmal vorbereitet. Job-Festplatten und Caches sind nicht Teil der Sicherungen; alte Engine-Caches werden beim Update entfernt.
- Labels sind keine Zugriffskontrolle; eine passend eingeschränkte persistente Registrierung verwenden.
- Leere Job-Abfragen erscheinen nur im Debug-Log; Jobzuweisungen und Abfragefehler bleiben sichtbar.
- Getrennte Aktionsquellen-Caches pro Job verhindern Blockaden durch zurückgelassene Git-Sperren.
- Die VM-Abbildvorbereitung zeigt Laden; inaktive Job-Slots zeigen Warten unabhängig von der Controller-Bereitschaft.
- Hotplug-RAM wird zwischen Kernel- und verschiebbaren Zonen ausgeglichen, um Kernel-Speichermangel trotz freiem RAM zu verhindern; unveränderte Ziele senden keine wiederholten Gerätenachrichten.
- Die öffentliche OS-Stamm-CA wird in Job-Containern und Node installiert; lokale Forgejo-Namen nutzen die OS-Bridge ohne deaktivierte TLS-Prüfung.
- Upstream-Lizenz auf GPL-3.0-or-later korrigiert.
- start-sdk auf 3.0.6 aktualisiert.`,
    pl_PL: `- Brak danych uwierzytelniających tworzy krytyczne zadanie Konfiguruj; ukończ je przed uruchomieniem runnera.
- Zastąpiono Podman silnikiem Docker i naprawiono mapowanie ID dla apt.
- Jedna trwała rejestracja runnera obsługuje wszystkie zadania. Każde zadanie wirtualizowane otrzymuje osobną jednorazową maszynę, także przy pracy równoległej.
- Maszyny startują dopiero po przydzieleniu zadania; bezczynne stanowiska nie utrzymują gości. Aktywni goście dzielą pulę RAM, wykorzystując wolne zasoby i czekając na potwierdzone odzyskanie pamięci przed kolejnym przydziałem.
- Wirtualizacja jest domyślnie włączona przy dostępnym KVM. Bez KVM opcja jest wyłączona i zablokowana; kontenery współdzielą jądro StartOS. Awaria VM nigdy nie przełącza automatycznie trybu.
- API Docker gości używają wzajemnego TLS osobno dla każdej VM. Ścieżki źródeł akcji są ograniczone, a rejestracja pozostaje poza gościem.
- Obrazy gości są przypięte, sprawdzane i przygotowywane jednorazowo. Dyski zadań oraz pamięci podręczne nie trafiają do kopii zapasowych; przy aktualizacji usuwane są stare pamięci podręczne silnika.
- Etykiety nie kontrolują dostępu; używaj trwałej rejestracji o odpowiednim zakresie.
- Puste odpytywania zadań są widoczne tylko w logach debugowania; przydziały i błędy pozostają widoczne.
- Osobne pamięci podręczne źródeł akcji dla każdego zadania zapobiegają blokowaniu przez porzucone blokady Git.
- Przygotowanie obrazu maszyny pokazuje Ładowanie, a bezczynne zadania Oczekiwanie, niezależnie od gotowości kontrolera.
- Dodawana pamięć równoważy strefy jądra i przenośne, zapobiegając brakowi pamięci jądra mimo wolnej RAM; niezmienione cele nie powtarzają powiadomień urządzenia.
- Publiczny główny certyfikat systemu trafia do kontenerów zadań i Node; lokalne nazwy Forgejo używają mostu systemu bez wyłączania weryfikacji TLS.
- Poprawiono licencję na GPL-3.0-or-later.
- Zaktualizowano start-sdk do 3.0.6.`,
    fr_FR: `- Sans identifiants, une tâche critique Configurer est créée ; terminez-la avant de démarrer le runner.
- Podman est remplacé par Docker, corrigeant le mappage des identifiants pour apt.
- Une seule inscription persistante sert toutes les tâches. Chaque tâche virtualisée reçoit sa propre VM jetable, y compris en parallèle.
- Les VM démarrent après attribution ; les emplacements inactifs ne gardent aucun invité. Les invités actifs partagent un budget RAM et empruntent la capacité libre ; toute nouvelle allocation attend la restitution confirmée de mémoire.
- La virtualisation est activée par défaut avec KVM. Sans KVM, l’option est désactivée et verrouillée ; les conteneurs partagent le noyau StartOS. Une panne de VM ne change jamais automatiquement de mode.
- Les API Docker invitées utilisent un TLS mutuel propre à chaque VM. Les chemins sources des actions sont bornés et l’inscription reste hors de l’invité.
- Les images invitées sont épinglées, vérifiées et préparées une fois. Les disques de tâches et caches sont exclus des sauvegardes ; les anciens caches du moteur sont supprimés à la mise à jour.
- Les étiquettes ne contrôlent pas l’accès ; utilisez une inscription persistante de portée adaptée.
- Les interrogations sans tâche restent au niveau debug ; les attributions et erreurs restent visibles.
- Les caches de sources des actions sont séparés par tâche pour éviter les blocages dus aux verrous Git abandonnés.
- La préparation de l’image indique Chargement ; les tâches inactives indiquent En attente sans bloquer le contrôleur.
- La mémoire ajoutée équilibre les zones noyau et mobiles pour éviter les OOM du noyau malgré de la RAM libre ; les cibles inchangées ne répètent plus les notifications.
- La CA racine publique du système est installée dans les tâches et Node ; les noms locaux de Forgejo passent par le pont OS sans désactiver la vérification TLS.
- Licence corrigée en GPL-3.0-or-later.
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
              'rm',
              '-rf',
              `${DATA_DIR}/runner`,
              `${SCRATCH_DIR}/docker`,
              `${SCRATCH_DIR}/jobs`,
            ],
            { user: 'root', timeout: null },
          ),
      )
    },
    down: IMPOSSIBLE,
  },
})
