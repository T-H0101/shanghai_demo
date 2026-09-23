/**
 * One-shot: sanitize user-facing error leaks in app/api routes.
 */
const fs = require("fs")
const path = require("path")

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, acc)
    else if (
      ent.name.endsWith(".ts") &&
      !ent.name.includes("__tests__") &&
      !ent.name.includes("self-check")
    ) {
      acc.push(p)
    }
  }
  return acc
}

const files = walk(path.join("app", "api"))
let changed = 0

for (const f of files) {
  let s = fs.readFileSync(f, "utf8")
  const orig = s

  s = s.replace(
    /message:\s*err\s+instanceof\s+Error\s*\?\s*err\.message\s*:\s*["']unknown["']/g,
    'message: "未知异常"',
  )
  s = s.replace(
    /message:\s*err\s+instanceof\s+Error\s*\?\s*err\.message\s*:\s*["']invalid request["']/g,
    'message: "请求无效，请检查后重试"',
  )
  s = s.replace(
    /message:\s*e\s+instanceof\s+Error\s*\?\s*e\.message\s*:\s*String\(e\)/g,
    'message: "未知异常"',
  )
  s = s.replace(
    /error:\s*e\s+instanceof\s+Error\s*\?\s*e\.message\s*:\s*String\(e\)/g,
    'message: "未知异常", error: "UNKNOWN_EXCEPTION"',
  )
  s = s.replace(
    /error:\s*err\s+instanceof\s+Error\s*\?\s*err\.message\s*:\s*String\(err\)/g,
    'message: "未知异常", error: "UNKNOWN_EXCEPTION"',
  )
  s = s.replace(
    /\{\s*code:\s*500,\s*error:\s*e\s+instanceof\s+Error\s*\?\s*e\.message\s*:\s*String\(e\)\s*\}/g,
    '{ code: 500, message: "未知异常", error: "UNKNOWN_EXCEPTION" }',
  )
  s = s.replace(
    /\{\s*code:\s*500,\s*error:\s*err\s+instanceof\s+Error\s*\?\s*err\.message\s*:\s*String\(err\)\s*\}/g,
    '{ code: 500, message: "未知异常", error: "UNKNOWN_EXCEPTION" }',
  )
  s = s.replace(
    /\{\s*code:\s*500,\s*message:\s*e\s+instanceof\s+Error\s*\?\s*e\.message\s*:\s*String\(e\)\s*\}/g,
    '{ code: 500, message: "未知异常" }',
  )
  s = s.replace(/"Internal server error"/g, '"未知异常"')
  s = s.replace(/'Internal server error'/g, "'未知异常'")
  s = s.replace(/"Unknown error"/g, '"未知异常"')
  s = s.replace(/'Unknown error'/g, "'未知异常'")
  s = s.replace(
    /const errorMessage = err instanceof Error \? err\.message : ['"]Unknown error['"]/g,
    'const errorMessage = "未知异常"',
  )
  s = s.replace(
    /const errorMessage = err instanceof Error \? err\.message : ['"]unknown['"]/g,
    'const errorMessage = "未知异常"',
  )
  s = s.replace(
    /message:\s*['"]failed to query[^'"]*['"]/gi,
    'message: "未知异常"',
  )

  if (s !== orig) {
    fs.writeFileSync(f, s)
    changed++
    console.log(f)
  }
}

console.log(`changed ${changed} of ${files.length}`)
