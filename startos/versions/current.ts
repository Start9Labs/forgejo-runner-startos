import { VersionInfo, IMPOSSIBLE, FileHelper, z } from '@start9labs/start-sdk'
import { storeJson } from '../fileModels/store.json'
import { sdk } from '../sdk'

const legacyStore = FileHelper.json(
  { base: sdk.volumes.main, subpath: './store.json' },
  z.looseObject({
    virtualization: z.boolean().optional(),
    execution: z.string().optional(),
  }),
)

export const current = VersionInfo.of({
  version: '13.2.2:2',
  releaseNotes: {
    en_US:
      'Jobs can now run in disposable VMs on a remote Incus server. Configure replaces the Virtualization switch with an Execution choice: Local VMs, Local containers or Remote Incus. Existing settings keep their mode.',
    es_ES:
      'Los trabajos ahora pueden ejecutarse en máquinas virtuales desechables en un servidor Incus remoto. Configurar sustituye el interruptor Virtualización por una opción de Ejecución: VM locales, Contenedores locales o Incus remoto. La configuración existente conserva su modo.',
    de_DE:
      'Jobs können jetzt in Einweg-VMs auf einem entfernten Incus-Server laufen. Konfigurieren ersetzt den Schalter Virtualisierung durch eine Auswahl unter Ausführung: Lokale VMs, Lokale Container oder Entferntes Incus. Bestehende Einstellungen behalten ihren Modus.',
    pl_PL:
      'Zadania mogą teraz działać w jednorazowych maszynach wirtualnych na zdalnym serwerze Incus. Konfiguracja zastępuje przełącznik Wirtualizacja wyborem Wykonanie: Lokalne VM, Lokalne kontenery lub Zdalny Incus. Istniejące ustawienia zachowują swój tryb.',
    fr_FR:
      "Les tâches peuvent désormais s'exécuter dans des VM jetables sur un serveur Incus distant. Configurer remplace l'interrupteur Virtualisation par un choix d'Exécution : VM locales, Conteneurs locaux ou Incus distant. Les réglages existants conservent leur mode.",
  },
  migrations: {
    up: async ({ effects }) => {
      const store = await legacyStore.read().once()
      if (store && !store.execution && store.virtualization === false) {
        await storeJson.merge(effects, { execution: 'container' })
      }
    },
    down: IMPOSSIBLE,
  },
})
