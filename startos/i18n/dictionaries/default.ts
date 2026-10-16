export const DEFAULT_LANG = 'en_US'

const dict = {
  'This device does not meet the minimum requirements to run CI jobs (4 GB of RAM and 2 CPU cores).': 0,
  'Store not found': 1,
  Runner: 2,
  'Runner is running': 3,
  'Run the Configure action to connect this runner to a Forgejo instance': 4,
  'Runner UUID': 5,
  'The runner UUID shown by Forgejo when you create a runner, under Site/Org/Repo Settings → Actions → Runners → Create new Runner.': 6,
  'Runner Token': 7,
  'The runner token shown alongside the UUID on the same Forgejo "Create new Runner" screen.': 8,
  Labels: 9,
  'Comma-separated runner labels — syntax "name:docker://image" or "name:host". For foreign-architecture jobs use the Enable Emulation toggle instead of adding arch labels by hand.': 10,
  'Concurrent Jobs': 11,
  "How many jobs run at the same time. Each job is a full build in its own container, and all of them share this device's CPU and memory.": 12,
  'Enable Emulation': 13,
  'Also serve jobs for the other CPU architecture, run under emulation (much slower than native). Appends a foreign-architecture label pinned to that platform; prefer a native runner per architecture for regular builds.': 14,
  Configure: 15,
  'Connect this runner to the Forgejo on this device. Saving a change restarts the runner if it is running.': 16,
  Saved: 17,
  'Runner configuration saved.': 18,
  'Forgejo is not yet reachable on the internal network. The runner will connect once its Forgejo dependency is running.': 19,
  'The runner is not running': 20,
  'Forgejo Actions must be enabled for Forgejo Runner to run jobs.': 21,
  'Forgejo no longer recognizes this runner. Create a new runner in Forgejo, enter its UUID and token in the Configure action, then restart this service.': 22,
  'Configure Build Runner': 23,
  'Configure the optional privileged build runner. Saving restarts both runners.': 24,
  'Use a separate registration scoped to trusted repositories or an organization, not a site-wide runner. Labels are not access control. Both runners share the outer StartOS service boundary.': 25,
  'Enable Build Runner': 26,
  'Allow privileged jobs with access to this runner’s Docker engine. Disabled by default.': 27,
  'Build Runner': 28,
  'Runner labels must use name:docker://image. Host labels are not allowed.': 29,
  'Configure the Build Runner credentials before enabling it.': 30,
  'Use a different Forgejo runner registration for each runner.': 31,
  'The two runners must advertise different labels.': 32,
  'Configure the unprivileged runner. Saving restarts both runners.': 33,
  'Forgejo no longer recognizes the build runner. Create a new scoped registration and enter it in Configure Build Runner.': 34,
  'Labels must be unique within each runner.': 35,
}

export type I18nKey = keyof typeof dict
export type LangDict = Partial<Record<(typeof dict)[I18nKey], string>>
export default dict
