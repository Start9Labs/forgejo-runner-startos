import { VersionInfo, IMPOSSIBLE } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '13.2.0:4',
  releaseNotes: {
    en_US:
      'Missing runner credentials now raise a critical Configure task instead of a failing health check. Complete it before starting the runner. Updated start-sdk to 3.0.6.',
    es_ES:
      'Si faltan las credenciales del ejecutor, se crea una tarea crítica Configurar en lugar de fallar la comprobación de estado. Complétela antes de iniciar el ejecutor. start-sdk actualizado a 3.0.6.',
    de_DE:
      'Fehlende Runner-Zugangsdaten lösen eine kritische Aufgabe „Konfigurieren“ statt einer fehlgeschlagenen Statusprüfung aus. Schließen Sie sie vor dem Start ab. start-sdk auf 3.0.6 aktualisiert.',
    pl_PL:
      'Brak danych uwierzytelniających runnera tworzy krytyczne zadanie Konfiguruj zamiast nieudanej kontroli stanu. Ukończ je przed uruchomieniem runnera. Zaktualizowano start-sdk do 3.0.6.',
    fr_FR:
      'Sans identifiants, une tâche critique Configurer remplace la vérification d’état en échec. Terminez-la avant de démarrer le runner. start-sdk mis à jour vers 3.0.6.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
