import { VersionInfo, IMPOSSIBLE } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '12.12.0:1',
  releaseNotes: {
    en_US: `Migrated to the Forgejo v12 connection model — Configure now takes the runner UUID and token from Forgejo's "Create new Runner" page (the deprecated register command is gone); existing runners must be reconfigured. Added an "Enable Emulation" toggle for foreign-architecture jobs.`,
    es_ES: `Migración al modelo de conexión de Forgejo v12: Configurar ahora utiliza el UUID y el token del ejecutor desde la página "Crear nuevo ejecutor" de Forgejo (el comando obsoleto register ya no se usa); los ejecutores existentes deben reconfigurarse. Se añadió un interruptor "Habilitar emulación" para trabajos de otra arquitectura.`,
    de_DE: `Umstellung auf das Verbindungsmodell von Forgejo v12: Konfigurieren verwendet jetzt die Runner-UUID und das Token von der Forgejo-Seite „Neuen Runner erstellen" (der veraltete Befehl register entfällt); bestehende Runner müssen neu konfiguriert werden. Ein Schalter „Emulation aktivieren" für Aufträge fremder Architektur wurde hinzugefügt.`,
    pl_PL: `Przejście na model połączeń Forgejo v12: Konfiguracja korzysta teraz z UUID i tokenu runnera ze strony „Utwórz nowego runnera" w Forgejo (przestarzałe polecenie register zostało usunięte); istniejące runnery wymagają ponownej konfiguracji. Dodano przełącznik „Włącz emulację" dla zadań innej architektury.`,
    fr_FR: `Passage au modèle de connexion de Forgejo v12 : Configurer utilise désormais l'UUID et le jeton du runner depuis la page « Créer un nouveau runner » de Forgejo (la commande obsolète register est supprimée) ; les runners existants doivent être reconfigurés. Ajout d'une bascule « Activer l'émulation » pour les tâches d'une autre architecture.`,
  },
  migrations: {
    // Store schema changed (registration token → connection UUID + token). The
    // new credentials can't be derived from the old, so users reconfigure; zod
    // handles the field changes on read, so there's no data transform to run.
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
