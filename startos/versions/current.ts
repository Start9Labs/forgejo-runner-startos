import { VersionInfo, IMPOSSIBLE } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '13.2.0:3',
  releaseNotes: {
    en_US:
      "- Configure says that saving a change restarts the runner if it is running.\n- Concurrent Jobs explains that every job is a full build sharing this device's CPU and memory.",
    es_ES:
      '- Configurar indica que guardar un cambio reinicia el ejecutor si está en ejecución.\n- Trabajos simultáneos explica que cada trabajo es una compilación completa que comparte la CPU y la memoria de este dispositivo.',
    de_DE:
      '- „Konfigurieren“ weist darauf hin, dass das Speichern einer Änderung den Runner neu startet, wenn er läuft.\n- „Gleichzeitige Aufträge“ erklärt, dass jeder Auftrag ein vollständiger Build ist, der sich CPU und Arbeitsspeicher dieses Geräts teilt.',
    pl_PL:
      '- Konfiguruj informuje, że zapisanie zmiany uruchamia runnera ponownie, jeśli działa.\n- Zadania równoległe wyjaśnia, że każde zadanie to pełna kompilacja dzieląca procesor i pamięć tego urządzenia.',
    fr_FR:
      "- Configurer indique qu'enregistrer une modification redémarre l'exécuteur s'il est en cours d'exécution.\n- Tâches simultanées explique que chaque tâche est une compilation complète qui partage le processeur et la mémoire de cet appareil.",
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
