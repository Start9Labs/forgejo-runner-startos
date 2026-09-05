import { VersionInfo, IMPOSSIBLE } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '13.1.0:0',
  releaseNotes: {
    en_US: `Updated Forgejo Runner to 13.1.0.

- Reusable matrix workflows can now distinguish internal jobs through namespaces.
- Container create, exec, and attach commands no longer inherit terminal behavior from the runner process.
- Includes upstream security updates for networking, archive, text, and gRPC dependencies.

Full upstream release notes: https://code.forgejo.org/forgejo/runner/releases/tag/v13.1.0`,
    es_ES: `Forgejo Runner actualizado a 13.1.0.

- Los flujos de trabajo de matriz reutilizables ahora pueden distinguir los trabajos internos mediante espacios de nombres.
- Los comandos de creación, ejecución y conexión de contenedores ya no heredan el comportamiento del terminal del proceso del runner.
- Incluye actualizaciones de seguridad del proyecto original para las dependencias de red, archivo, texto y gRPC.

Notas de la versión original completas: https://code.forgejo.org/forgejo/runner/releases/tag/v13.1.0`,
    de_DE: `Forgejo Runner auf 13.1.0 aktualisiert.

- Wiederverwendbare Matrix-Workflows können interne Jobs jetzt über Namensräume unterscheiden.
- Befehle zum Erstellen, Ausführen und Anhängen von Containern übernehmen das Terminalverhalten des Runner-Prozesses nicht mehr.
- Enthält Sicherheitsaktualisierungen des Upstream-Projekts für Netzwerk-, Archiv-, Text- und gRPC-Abhängigkeiten.

Vollständige Veröffentlichungshinweise des Upstream-Projekts: https://code.forgejo.org/forgejo/runner/releases/tag/v13.1.0`,
    pl_PL: `Zaktualizowano Forgejo Runner do wersji 13.1.0.

- Workflowy macierzowe wielokrotnego użytku mogą teraz rozróżniać zadania wewnętrzne za pomocą przestrzeni nazw.
- Polecenia tworzenia, wykonywania i dołączania kontenerów nie dziedziczą już zachowania terminala z procesu runnera.
- Zawiera aktualizacje bezpieczeństwa projektu źródłowego dla zależności sieciowych, archiwizacyjnych, tekstowych i gRPC.

Pełne informacje o wydaniu projektu źródłowego: https://code.forgejo.org/forgejo/runner/releases/tag/v13.1.0`,
    fr_FR: `Forgejo Runner mis à jour vers 13.1.0.

- Les workflows matriciels réutilisables peuvent désormais distinguer les tâches internes grâce aux espaces de noms.
- Les commandes de création, d’exécution et d’attachement de conteneurs n’héritent plus du comportement du terminal du processus du runner.
- Inclut les mises à jour de sécurité du projet amont pour les dépendances de réseau, d’archivage, de texte et gRPC.

Notes de version complètes du projet amont : https://code.forgejo.org/forgejo/runner/releases/tag/v13.1.0`,
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
