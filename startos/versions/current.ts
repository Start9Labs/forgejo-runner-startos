import { VersionInfo, IMPOSSIBLE } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '13.0.0:2',
  releaseNotes: {
    en_US: `Updated Forgejo Runner to 13.0.0.

A major release that makes Forgejo Actions stricter and safer. Review your workflows before updating:

- Invalid workflow syntax now fails the job instead of only logging a warning — including expressions that cannot be interpolated and \`strategy.matrix\` exclusions that match no value.
- The \`set-output\`, \`set-env\` and \`add-path\` workflow commands were removed. Write to \`$FORGEJO_OUTPUT\`, \`$FORGEJO_ENV\` and \`$FORGEJO_PATH\` instead.
- Container registry logins now come from \`jobs.<job_id>.container.credentials\` instead of the \`DOCKER_USERNAME\` and \`DOCKER_PASSWORD\` secrets.
- Also fixed: commit impersonation via \`refs/replace/*\` while a job checks out an action.

Packaging: this release also fixes two problems with the bundled Podman engine: jobs failing before their first step because it could not open the tunnel device that gives each job container a network, and job images containing files not owned by root — most Ubuntu-based images — failing to unpack. It also clears the engine's leftover runtime state when the service starts, so rebooting the server no longer leaves the runner restarting in a loop and never picking up jobs. The health check now reflects whether the runner is actually running.

Breaking changes explained: https://forgejo.org/2026-08-runner-release-v13/

Full upstream release notes: https://code.forgejo.org/forgejo/runner/releases/tag/v13.0.0`,
    es_ES: `Forgejo Runner actualizado a 13.0.0.

Una versión mayor que hace Forgejo Actions más estricto y seguro. Revise sus flujos de trabajo antes de actualizar:

- La sintaxis de flujo de trabajo no válida ahora hace fallar el trabajo en lugar de solo registrar un aviso, incluidas las expresiones que no se pueden interpolar y las exclusiones de \`strategy.matrix\` que no coinciden con ningún valor.
- Los comandos de flujo de trabajo \`set-output\`, \`set-env\` y \`add-path\` se han eliminado. Escriba en \`$FORGEJO_OUTPUT\`, \`$FORGEJO_ENV\` y \`$FORGEJO_PATH\` en su lugar.
- Los inicios de sesión en registros de contenedores ahora provienen de \`jobs.<job_id>.container.credentials\` en lugar de los secretos \`DOCKER_USERNAME\` y \`DOCKER_PASSWORD\`.
- También corregido: la suplantación de commits mediante \`refs/replace/*\` mientras un trabajo obtiene una acción.

Empaquetado: este lanzamiento corrige además dos problemas del motor Podman incluido: los trabajos fallaban antes de su primer paso porque no podía abrir el dispositivo de túnel que da red a cada contenedor de trabajo, y las imágenes de trabajo con archivos que no pertenecen a root —la mayoría de las basadas en Ubuntu— no se descomprimían. También limpia el estado de ejecución que el motor deja atrás al iniciarse el servicio, de modo que reiniciar el servidor ya no deja al runner reiniciándose en bucle sin recoger ningún trabajo. La comprobación de estado ahora refleja si el ejecutor está realmente en ejecución.

Explicación de los cambios incompatibles: https://forgejo.org/2026-08-runner-release-v13/

Notas de la versión original completas: https://code.forgejo.org/forgejo/runner/releases/tag/v13.0.0`,
    de_DE: `Forgejo Runner auf 13.0.0 aktualisiert.

Eine Hauptversion, die Forgejo Actions strenger und sicherer macht. Prüfen Sie Ihre Workflows vor der Aktualisierung:

- Ungültige Workflow-Syntax lässt den Job jetzt fehlschlagen, statt nur eine Warnung zu protokollieren — darunter Ausdrücke, die nicht interpoliert werden können, und \`strategy.matrix\`-Ausschlüsse, die auf keinen Wert passen.
- Die Workflow-Befehle \`set-output\`, \`set-env\` und \`add-path\` wurden entfernt. Schreiben Sie stattdessen in \`$FORGEJO_OUTPUT\`, \`$FORGEJO_ENV\` und \`$FORGEJO_PATH\`.
- Anmeldungen an Container-Registries stammen jetzt aus \`jobs.<job_id>.container.credentials\` statt aus den Secrets \`DOCKER_USERNAME\` und \`DOCKER_PASSWORD\`.
- Ebenfalls behoben: Commit-Identitätsfälschung über \`refs/replace/*\`, während ein Job eine Action auscheckt.

Paketierung: Diese Version behebt außerdem zwei Probleme der mitgelieferten Podman-Engine: Jobs scheiterten vor ihrem ersten Schritt, weil sie das Tunnelgerät nicht öffnen konnte, das jedem Job-Container ein Netzwerk gibt, und Job-Images mit Dateien, die nicht root gehören — die meisten Ubuntu-basierten Images — ließen sich nicht entpacken. Außerdem wird beim Start des Dienstes der zurückgebliebene Laufzeitzustand der Engine bereinigt, sodass ein Neustart des Servers den Runner nicht mehr in einer Endlosschleife hängen lässt, in der er keine Jobs annimmt. Die Statusprüfung zeigt jetzt an, ob der Runner tatsächlich läuft.

Erläuterung der inkompatiblen Änderungen: https://forgejo.org/2026-08-runner-release-v13/

Vollständige Veröffentlichungshinweise des Upstream-Projekts: https://code.forgejo.org/forgejo/runner/releases/tag/v13.0.0`,
    pl_PL: `Zaktualizowano Forgejo Runner do wersji 13.0.0.

Duże wydanie, które czyni Forgejo Actions bardziej rygorystycznym i bezpiecznym. Przejrzyj swoje workflowy przed aktualizacją:

- Nieprawidłowa składnia workflow powoduje teraz niepowodzenie zadania zamiast samego ostrzeżenia w dzienniku — dotyczy to wyrażeń, których nie da się zinterpolować, oraz wykluczeń \`strategy.matrix\`, które nie pasują do żadnej wartości.
- Polecenia workflow \`set-output\`, \`set-env\` i \`add-path\` zostały usunięte. Zamiast nich zapisuj do \`$FORGEJO_OUTPUT\`, \`$FORGEJO_ENV\` i \`$FORGEJO_PATH\`.
- Logowanie do rejestrów kontenerów pochodzi teraz z \`jobs.<job_id>.container.credentials\`, a nie z sekretów \`DOCKER_USERNAME\` i \`DOCKER_PASSWORD\`.
- Naprawiono również: podszywanie się pod autora commita przez \`refs/replace/*\` podczas pobierania akcji przez zadanie.

Pakowanie: to wydanie naprawia też dwa problemy wbudowanego silnika Podman: zadania kończyły się niepowodzeniem przed pierwszym krokiem, bo nie mógł on otworzyć urządzenia tunelowego dającego sieć każdemu kontenerowi zadania, a obrazy zadań zawierające pliki nienależące do roota — czyli większość opartych na Ubuntu — nie dawały się rozpakować. Czyści też pozostały stan uruchomieniowy silnika przy starcie usługi, dzięki czemu ponowne uruchomienie serwera nie zostawia już runnera w pętli restartów bez pobierania zadań. Kontrola stanu pokazuje teraz, czy runner faktycznie działa.

Wyjaśnienie zmian niezgodnych wstecz: https://forgejo.org/2026-08-runner-release-v13/

Pełne informacje o wydaniu projektu źródłowego: https://code.forgejo.org/forgejo/runner/releases/tag/v13.0.0`,
    fr_FR: `Forgejo Runner mis à jour vers 13.0.0.

Une version majeure qui rend Forgejo Actions plus strict et plus sûr. Vérifiez vos workflows avant de mettre à jour :

- Une syntaxe de workflow invalide fait désormais échouer la tâche au lieu de simplement journaliser un avertissement — y compris les expressions qui ne peuvent pas être interpolées et les exclusions \`strategy.matrix\` qui ne correspondent à aucune valeur.
- Les commandes de workflow \`set-output\`, \`set-env\` et \`add-path\` ont été supprimées. Écrivez plutôt dans \`$FORGEJO_OUTPUT\`, \`$FORGEJO_ENV\` et \`$FORGEJO_PATH\`.
- Les connexions aux registres de conteneurs proviennent maintenant de \`jobs.<job_id>.container.credentials\` au lieu des secrets \`DOCKER_USERNAME\` et \`DOCKER_PASSWORD\`.
- Également corrigé : l'usurpation de commit via \`refs/replace/*\` lorsqu'une tâche récupère une action.

Empaquetage : cette version corrige aussi deux problèmes du moteur Podman intégré : les jobs échouaient avant leur première étape car il ne parvenait pas à ouvrir le périphérique tunnel qui donne un réseau à chaque conteneur de job, et les images de job contenant des fichiers n'appartenant pas à root — la plupart des images basées sur Ubuntu — ne se décompressaient pas. Elle nettoie aussi l'état d'exécution laissé par le moteur au démarrage du service, de sorte que redémarrer le serveur ne laisse plus le runner redémarrer en boucle sans jamais prendre de jobs. La vérification d'état indique désormais si l'exécuteur fonctionne réellement.

Explication des changements incompatibles : https://forgejo.org/2026-08-runner-release-v13/

Notes de version complètes du projet amont : https://code.forgejo.org/forgejo/runner/releases/tag/v13.0.0`,
  },
  migrations: {
    // Store schema changed (registration token → connection UUID + token). The
    // new credentials can't be derived from the old, so users reconfigure; zod
    // handles the field changes on read, so there's no data transform to run.
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
