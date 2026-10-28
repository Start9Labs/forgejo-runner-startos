import { VersionInfo, IMPOSSIBLE } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '13.2.0:7',
  releaseNotes: {
    en_US:
      'The runner can now take jobs from a Forgejo on another server. Choose Remote server under Forgejo Instance in the Configure action and enter its address; Forgejo on this server is then not needed.',
    es_ES:
      'El ejecutor ahora puede tomar trabajos de un Forgejo en otro servidor. Elija Servidor remoto en Instancia de Forgejo en la acción Configurar e introduzca su dirección; entonces no se necesita Forgejo en este servidor.',
    de_DE:
      'Der Runner kann jetzt Jobs von einem Forgejo auf einem anderen Server übernehmen. Wählen Sie in der Aktion Konfigurieren unter Forgejo-Instanz „Entfernter Server“ und geben Sie dessen Adresse ein; Forgejo auf diesem Server wird dann nicht benötigt.',
    pl_PL:
      'Runner może teraz pobierać zadania z Forgejo na innym serwerze. W akcji Konfiguruj wybierz Serwer zdalny w polu Instancja Forgejo i podaj jego adres; Forgejo na tym serwerze nie jest wtedy potrzebne.',
    fr_FR:
      "Le runner peut désormais recevoir des tâches d'un Forgejo sur un autre serveur. Choisissez Serveur distant sous Instance Forgejo dans l'action Configurer et saisissez son adresse ; Forgejo n'est alors plus nécessaire sur ce serveur.",
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
