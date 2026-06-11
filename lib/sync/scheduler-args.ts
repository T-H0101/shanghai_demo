const SITE_CODE_PATTERN = /^[A-Za-z0-9_-]+$/

function readOption(args: string[], name: string): string | undefined {
  const equalsPrefix = `${name}=`
  const equalsArg = args.find((arg) => arg.startsWith(equalsPrefix))
  if (equalsArg) return equalsArg.slice(equalsPrefix.length)

  const index = args.indexOf(name)
  if (index >= 0) return args[index + 1]
  return undefined
}

export function parseSchedulerArgs(args: string[]) {
  const explicitSiteCode = readOption(args, "--siteCode")
  const positionalSiteCode = args.find(
    (arg) => arg !== "--" && !arg.startsWith("--") && arg !== "once"
  )
  const siteCode = explicitSiteCode ?? positionalSiteCode ?? "SH01"

  if (!SITE_CODE_PATTERN.test(siteCode)) {
    throw new Error(`Invalid siteCode: ${siteCode}`)
  }

  const intervalRaw = readOption(args, "--interval") ?? "3600"
  const intervalSeconds = Number.parseInt(intervalRaw, 10)
  if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
    throw new Error(`Invalid interval: ${intervalRaw}`)
  }

  return {
    siteCode,
    intervalSeconds,
    once: args.includes("--once"),
    dryRun: args.includes("--dry-run"),
  }
}
