import { VersionInfo, IMPOSSIBLE } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '13.2.2:1',
  releaseNotes: {
    en_US:
      'Requires StartOS 0.4.2 or later. Configure now rejects labels containing quotes or backslashes, and stores labels and the token exactly as entered.',
    es_ES:
      'Requiere StartOS 0.4.2 o posterior. Configurar ahora rechaza etiquetas que contienen comillas o barras invertidas, y guarda las etiquetas y el token exactamente como se introducen.',
    de_DE:
      'Erfordert StartOS 0.4.2 oder neuer. Konfigurieren lehnt jetzt Labels mit Anführungszeichen oder Backslashes ab und speichert Labels und Token genau wie eingegeben.',
    pl_PL:
      'Wymaga StartOS 0.4.2 lub nowszego. Konfiguracja odrzuca teraz etykiety zawierające cudzysłowy lub ukośniki wsteczne, a etykiety i token zapisuje dokładnie tak, jak zostały wpisane.',
    fr_FR:
      'Nécessite StartOS 0.4.2 ou une version ultérieure. Configurer refuse désormais les libellés contenant des guillemets ou des barres obliques inverses, et enregistre les libellés et le jeton exactement tels que saisis.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
