import { VersionInfo, IMPOSSIBLE } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '13.2.0:7',
  releaseNotes: {
    en_US:
      'Removes the temporary certificate-store upgrade layer now that the Debian base image has been rebuilt. The compromised eMudhra certificates remain untrusted.',
    es_ES:
      'Elimina la capa temporal de actualización del almacén de certificados ahora que se ha reconstruido la imagen base de Debian. Los certificados comprometidos de eMudhra siguen sin ser de confianza.',
    de_DE:
      'Entfernt die temporäre Aktualisierungsschicht für den Zertifikatsspeicher nach der Neuerstellung des Debian-Basisimages. Die kompromittierten eMudhra-Zertifikate bleiben nicht vertrauenswürdig.',
    pl_PL:
      'Usuwa tymczasową warstwę aktualizacji magazynu certyfikatów po przebudowaniu obrazu bazowego Debiana. Przejęte certyfikaty eMudhra nadal nie są zaufane.',
    fr_FR:
      'Supprime la couche temporaire de mise à jour du magasin de certificats après la reconstruction de l’image de base Debian. Les certificats compromis d’eMudhra restent non fiables.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
