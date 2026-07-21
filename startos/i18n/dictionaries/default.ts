export const DEFAULT_LANG = 'en_US'

const dict = {
  'This device does not meet the minimum requirements to run CI jobs (2 GiB RAM and 2 CPU cores).': 0,
  'Store not found': 1,
  Runner: 2,
  'Runner is configured': 3,
  'Run the Configure action to connect this runner to a Forgejo instance': 4,
  'Runner UUID': 5,
  'The runner UUID shown by Forgejo when you create a runner, under Site/Org/Repo Settings → Actions → Runners → Create new Runner.': 6,
  'Runner Token': 7,
  'The runner token shown alongside the UUID on the same Forgejo "Create new Runner" screen.': 8,
  Labels: 9,
  'Comma-separated runner labels — syntax "name:docker://image" or "name:host". For foreign-architecture jobs use the Enable Emulation toggle instead of adding arch labels by hand.': 10,
  'Concurrent Jobs': 11,
  'How many jobs this runner executes at once.': 12,
  'Enable Emulation': 13,
  'Also serve jobs for the other CPU architecture, run under emulation (much slower than native). Appends a foreign-architecture label pinned to that platform; prefer a native runner per architecture for regular builds.': 14,
  Configure: 15,
  'Connect this runner to the Forgejo on this device. Saving applies on the next restart.': 16,
  Saved: 17,
  'Runner configuration saved. Restart the service to apply.': 18,
  'Forgejo is not yet reachable on the internal network. The runner will connect once its Forgejo dependency is running.': 19,
}

export type I18nKey = keyof typeof dict
export type LangDict = Partial<Record<(typeof dict)[I18nKey], string>>
export default dict
