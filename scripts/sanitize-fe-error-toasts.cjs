/**
 * Sanitize remaining frontend toast/setError raw exception dumps.
 */
const fs = require("fs")
const path = require("path")

const targets = [
  "app/(platform)/sync/page.tsx",
  "components/users/auth-accounts-panel.tsx",
  "components/sites/site-regions-panel.tsx",
  "components/users/builtin-roles-panel.tsx",
  "components/auth/change-password-dialog.tsx",
  "components/racks/cage-move-view.tsx",
]

function ensureImport(s) {
  if (s.includes("formatApiErrorMessage")) return s
  if (s.includes('from "@/hooks/use-toast"')) {
    return s.replace(
      'from "@/hooks/use-toast"',
      'from "@/hooks/use-toast"\nimport { formatApiErrorMessage, httpStatusMessage } from "@/lib/api/http-error"',
    )
  }
  if (s.includes('from "@/lib/utils"')) {
    return s.replace(
      'from "@/lib/utils"',
      'from "@/lib/utils"\nimport { formatApiErrorMessage, httpStatusMessage } from "@/lib/api/http-error"',
    )
  }
  return (
    'import { formatApiErrorMessage, httpStatusMessage } from "@/lib/api/http-error"\n' + s
  )
}

for (const rel of targets) {
  const f = path.join(process.cwd(), rel)
  if (!fs.existsSync(f)) {
    console.log("skip missing", rel)
    continue
  }
  let s = fs.readFileSync(f, "utf8")
  const orig = s
  s = ensureImport(s)
  s = s.replace(
    /description:\s*e\s+instanceof\s+Error\s*\?\s*e\.message\s*:\s*String\(e\)/g,
    "description: formatApiErrorMessage(e)",
  )
  s = s.replace(
    /description:\s*err\s+instanceof\s+Error\s*\?\s*err\.message\s*:\s*String\(err\)/g,
    "description: formatApiErrorMessage(err)",
  )
  s = s.replace(
    /description:\s*error\s+instanceof\s+Error\s*\?\s*error\.message\s*:\s*[^,\n]+/g,
    "description: formatApiErrorMessage(error)",
  )
  s = s.replace(
    /const msg = e instanceof Error \? e\.message : ['"]Unknown error['"]/g,
    "const msg = formatApiErrorMessage(e)",
  )
  s = s.replace(
    /const msg = e instanceof Error \? e\.message : String\(e\)/g,
    "const msg = formatApiErrorMessage(e)",
  )
  s = s.replace(
    /setSyncAlertError\(err instanceof Error \? err\.message : ["']同步告警读取失败["']\)/g,
    'setSyncAlertError(formatApiErrorMessage(err))',
  )
  s = s.replace(
    /description:\s*json\?\.error\s*\?\?\s*`HTTP \$\{res\.status\}`/g,
    "description: formatApiErrorMessage(json?.error ?? httpStatusMessage(res.status))",
  )
  s = s.replace(
    /description:\s*json\?\.error\s*\?\?\s*`HTTP \$\{[^}]+\}`/g,
    "description: formatApiErrorMessage(json?.error ?? httpStatusMessage(res.status))",
  )

  if (s !== orig) {
    fs.writeFileSync(f, s)
    console.log("updated", rel)
  } else {
    console.log("unchanged", rel)
  }
}
