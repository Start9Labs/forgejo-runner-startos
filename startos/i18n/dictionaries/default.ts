export const DEFAULT_LANG = 'en_US'

const dict = {
  'This device does not meet the minimum requirements to run CI jobs (2 GiB RAM and 2 CPU cores).': 0,
  'Store not found': 1,
  Runner: 2,
  'Runner is configured': 3,
  'Run the Configure action to connect this runner to a Forgejo instance': 4,
  'Registration Token': 5,
  'A runner registration token from the Forgejo instance, under Site/Org/Repo Settings → Actions → Runners → Create new Runner.': 6,
  'Runner Name': 7,
  'A name to identify this runner in the Forgejo UI.': 8,
  Labels: 9,
  'Comma-separated runner labels — syntax "name:docker://image" or "name:host". Adding a foreign-arch label also serves emulated jobs, which are much slower; prefer a native runner per architecture.': 10,
  'Concurrent Jobs': 11,
  'How many jobs this runner executes at once.': 12,
  Configure: 13,
  'Register this runner with the Forgejo on this device. Saving re-registers on the next restart, so provide a fresh registration token each time.': 14,
  Saved: 15,
  'Runner configuration saved. Restart the service to (re)register with these settings.': 16,
}

export type I18nKey = keyof typeof dict
export type LangDict = Partial<Record<(typeof dict)[I18nKey], string>>
export default dict
