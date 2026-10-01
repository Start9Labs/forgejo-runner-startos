import { VersionInfo, IMPOSSIBLE } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '13.2.0:2',
  releaseNotes: {
    en_US:
      'If Forgejo no longer recognizes the runner, for example after Forgejo is reinstalled, the Runner health check asks you to create a new runner in Forgejo and enter its UUID and token in Configure.',
    es_ES:
      'Si Forgejo ya no reconoce el ejecutor, por ejemplo tras reinstalar Forgejo, la comprobación de estado Runner le pide crear un nuevo ejecutor en Forgejo e introducir su UUID y su token en Configurar.',
    de_DE:
      'Erkennt Forgejo den Runner nicht mehr, etwa nach einer Neuinstallation von Forgejo, fordert die Integritätsprüfung Runner Sie auf, in Forgejo einen neuen Runner zu erstellen und dessen UUID und Token in „Konfigurieren“ einzugeben.',
    pl_PL:
      'Jeśli Forgejo przestanie rozpoznawać runnera, na przykład po ponownej instalacji Forgejo, kontrola stanu Runner poprosi o utworzenie nowego runnera w Forgejo i wpisanie jego UUID i tokenu w Konfiguruj.',
    fr_FR:
      "Si Forgejo ne reconnaît plus l'exécuteur, par exemple après une réinstallation de Forgejo, la vérification d'état Runner vous demande de créer un nouvel exécuteur dans Forgejo et de saisir son UUID et son jeton dans Configurer.",
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
