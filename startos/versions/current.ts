import { VersionInfo, IMPOSSIBLE } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '13.2.0:6',
  releaseNotes: {
    en_US: `- One persistent runner registration now serves all jobs. Virtualized jobs each receive a fresh disposable VM, including concurrent jobs.
- Virtualization defaults on when KVM is available. Without KVM the option is off and disabled; container mode remains available and shares the StartOS kernel. VM failures never silently select container mode.
- Guest Docker APIs use per-VM mutual TLS. The runner is built with action-source path containment and keeps its registration outside the guest.
- Guest images are pinned, verified and prepared once; job disks and engine caches are excluded from backups.
- Reconfigure through Configure when replacing a separate-runner setup. Workflow labels are routing, not access control; use an appropriately scoped persistent registration.
- Corrected the upstream license to GPL-3.0-or-later.`,
    es_ES: `- Un único registro persistente atiende todos los trabajos. Cada trabajo virtualizado recibe una máquina virtual desechable propia, también al ejecutarse en paralelo.
- La virtualización está activada por defecto si hay KVM. Sin KVM, la opción queda desactivada y bloqueada; los contenedores siguen disponibles y comparten el núcleo de StartOS. Un fallo de VM nunca cambia de modo automáticamente.
- Las API Docker de invitados usan TLS mutuo por VM. El ejecutor limita las rutas de origen de acciones y mantiene su registro fuera del invitado.
- Las imágenes de invitados están fijadas, verificadas y se preparan una sola vez. Los discos de trabajos y las cachés se excluyen de las copias de seguridad.
- Reconfigure mediante Configurar al sustituir una instalación con ejecutores separados. Las etiquetas no controlan el acceso; use un registro persistente con alcance adecuado.
- Licencia corregida a GPL-3.0-or-later.`,
    de_DE: `- Eine persistente Runner-Registrierung bedient alle Jobs. Jeder virtualisierte Job erhält eine eigene wegwerfbare VM, auch bei paralleler Ausführung.
- Virtualisierung ist mit KVM standardmäßig aktiv. Ohne KVM ist die Option deaktiviert und gesperrt; Container teilen den StartOS-Kernel. VM-Fehler wechseln niemals automatisch den Modus.
- Gast-Docker-APIs nutzen gegenseitiges TLS pro VM. Aktionsquellpfade sind begrenzt; die Registrierung bleibt außerhalb des Gasts.
- Gast-Images sind festgelegt, geprüft und werden einmal vorbereitet. Job-Festplatten und Caches sind nicht Teil der Sicherungen.
- Eine Einrichtung mit getrennten Runnern unter Konfigurieren neu einrichten. Labels sind keine Zugriffskontrolle; eine passend eingeschränkte persistente Registrierung verwenden.
- Upstream-Lizenz auf GPL-3.0-or-later korrigiert.`,
    pl_PL: `- Jedna trwała rejestracja runnera obsługuje wszystkie zadania. Każde zadanie wirtualizowane otrzymuje osobną jednorazową maszynę, także przy pracy równoległej.
- Wirtualizacja jest domyślnie włączona przy dostępnym KVM. Bez KVM opcja jest wyłączona i zablokowana; kontenery współdzielą jądro StartOS. Awaria VM nigdy nie przełącza automatycznie trybu.
- API Docker gości używają wzajemnego TLS osobno dla każdej VM. Ścieżki źródeł akcji są ograniczone, a rejestracja pozostaje poza gościem.
- Obrazy gości są przypięte, sprawdzane i przygotowywane jednorazowo. Dyski zadań oraz pamięci podręczne nie trafiają do kopii zapasowych.
- Przy zastępowaniu oddzielnych runnerów użyj Konfiguruj. Etykiety nie kontrolują dostępu; używaj trwałej rejestracji o odpowiednim zakresie.
- Poprawiono licencję na GPL-3.0-or-later.`,
    fr_FR: `- Une seule inscription persistante sert toutes les tâches. Chaque tâche virtualisée reçoit sa propre VM jetable, y compris en parallèle.
- La virtualisation est activée par défaut avec KVM. Sans KVM, l’option est désactivée et verrouillée ; les conteneurs partagent le noyau StartOS. Une panne de VM ne change jamais automatiquement de mode.
- Les API Docker invitées utilisent un TLS mutuel propre à chaque VM. Les chemins sources des actions sont bornés et l’inscription reste hors de l’invité.
- Les images invitées sont épinglées, vérifiées et préparées une fois. Les disques de tâches et caches sont exclus des sauvegardes.
- Utilisez Configurer pour remplacer une installation à exécuteurs séparés. Les étiquettes ne contrôlent pas l’accès ; utilisez une inscription persistante de portée adaptée.
- Licence corrigée en GPL-3.0-or-later.`,
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
