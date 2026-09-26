import { VersionInfo, IMPOSSIBLE } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '13.2.0:1',
  releaseNotes: {
    en_US: `Requires Forgejo Actions to be enabled in Forgejo, and raises a task on Forgejo to turn it back on if it is disabled.

Updated Forgejo Runner to 13.2.0.

- Action repositories are fetched more efficiently, reducing initial clone time and cache disk use.
- Workflow steps can now upload job summaries.
- Jobs no longer panic when cancelled during startup, environment lifetimes respect job timeouts, and step working copies are cleaned up reliably.
- Invalid job definitions in reusable workflows now fail before execution.

Full upstream release notes: https://code.forgejo.org/forgejo/runner/releases/tag/v13.2.0`,
    es_ES: `Requiere que Forgejo Actions esté activado en Forgejo y crea una tarea en Forgejo para volver a activarlo si está desactivado.

Forgejo Runner actualizado a 13.2.0.

- Los repositorios de acciones se obtienen de forma más eficiente, lo que reduce el tiempo de clonación inicial y el uso de disco de la caché.
- Los pasos de los flujos de trabajo ahora pueden enviar resúmenes de trabajos.
- Los trabajos ya no fallan al cancelarse durante el inicio, la duración de los entornos respeta los tiempos límite de los trabajos y las copias de trabajo de los pasos se limpian de forma fiable.
- Las definiciones de trabajos no válidas en flujos de trabajo reutilizables ahora fallan antes de ejecutarse.

Notas de la versión original completas: https://code.forgejo.org/forgejo/runner/releases/tag/v13.2.0`,
    de_DE: `Setzt voraus, dass Forgejo Actions in Forgejo aktiviert ist, und erstellt in Forgejo eine Aufgabe zum erneuten Aktivieren, falls es deaktiviert ist.

Forgejo Runner auf 13.2.0 aktualisiert.

- Action-Repositories werden effizienter abgerufen, wodurch das erstmalige Klonen schneller ist und der Cache weniger Speicherplatz belegt.
- Workflow-Schritte können jetzt Job-Zusammenfassungen hochladen.
- Jobs stürzen bei einem Abbruch während des Starts nicht mehr ab, Umgebungen halten Job-Zeitlimits ein und Arbeitskopien von Schritten werden zuverlässig bereinigt.
- Ungültige Job-Definitionen in wiederverwendbaren Workflows schlagen jetzt vor der Ausführung fehl.

Vollständige Veröffentlichungshinweise des Upstream-Projekts: https://code.forgejo.org/forgejo/runner/releases/tag/v13.2.0`,
    pl_PL: `Wymaga włączenia Forgejo Actions w Forgejo i tworzy w Forgejo zadanie ponownego włączenia, jeśli jest wyłączone.

Zaktualizowano Forgejo Runner do wersji 13.2.0.

- Repozytoria akcji są pobierane wydajniej, co skraca czas początkowego klonowania i zmniejsza użycie miejsca na dysku przez pamięć podręczną.
- Kroki workflowów mogą teraz przesyłać podsumowania zadań.
- Zadania nie ulegają już awarii po anulowaniu podczas uruchamiania, środowiska przestrzegają limitów czasu zadań, a kopie robocze kroków są niezawodnie usuwane.
- Nieprawidłowe definicje zadań w workflowach wielokrotnego użytku kończą się teraz błędem przed wykonaniem.

Pełne informacje o wydaniu projektu źródłowego: https://code.forgejo.org/forgejo/runner/releases/tag/v13.2.0`,
    fr_FR: `Nécessite que Forgejo Actions soit activé dans Forgejo et crée une tâche dans Forgejo pour le réactiver s'il est désactivé.

Forgejo Runner mis à jour vers 13.2.0.

- Les dépôts d’actions sont récupérés plus efficacement, ce qui réduit le temps du clonage initial et l’espace disque utilisé par le cache.
- Les étapes des workflows peuvent désormais envoyer des résumés de tâches.
- Les tâches ne plantent plus lorsqu’elles sont annulées au démarrage, les environnements respectent les délais d’expiration des tâches et les copies de travail des étapes sont nettoyées de manière fiable.
- Les définitions de tâches invalides dans les workflows réutilisables échouent désormais avant leur exécution.

Notes de version complètes du projet amont : https://code.forgejo.org/forgejo/runner/releases/tag/v13.2.0`,
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
