#Requires -Version 5.1
param(
  [string]$OutDir = "D:\项目记录\00-部署\unified-offline",
  [string]$NodeVersion = "22.23.1",
  [string]$PnpmVersion = "11.3.0",
  [string]$PostgresImage = "postgres:17",
  [string]$NodeDockerImage = "node:22-bookworm-slim",
  [switch]$SkipBuild,
  [switch]$SkipPostgresSave
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Write-Step([string]$msg) { Write-Host ""; Write-Host "=== $msg ===" -ForegroundColor Cyan }
function Write-Ok([string]$msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-WarnMsg([string]$msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }

function Write-Utf8Lf([string]$Path, [string]$Content) {
  $utf8 = New-Object System.Text.UTF8Encoding $false
  $normalized = $Content -replace "`r`n", "`n" -replace "`r", "`n"
  if (-not $normalized.EndsWith("`n")) { $normalized += "`n" }
  [System.IO.File]::WriteAllText($Path, $normalized, $utf8)
}

Write-Step "OutDir = $OutDir"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$AppDir = Join-Path $OutDir "app"
$ToolsDir = Join-Path $OutDir "tools"
$ImagesDir = Join-Path $OutDir "images"
New-Item -ItemType Directory -Force -Path $ToolsDir, $ImagesDir | Out-Null

Write-Step "Sync source to app/"
if (Test-Path $AppDir) {
  Write-WarnMsg "Removing old app/"
  Remove-Item -Recurse -Force $AppDir
}
New-Item -ItemType Directory -Force -Path $AppDir | Out-Null

& robocopy $RepoRoot $AppDir /E /NFL /NDL /NJH /NJS /nc /ns /np `
  /XD node_modules .next .git .turbo coverage offline-bundle deploy .claude .agents `
  /XF "*.log" ".env.local" ".env*.local" "*.tar" "*.tar.gz" "*.tar.xz"
if ($LASTEXITCODE -ge 8) { throw "robocopy failed: $LASTEXITCODE" }
Write-Ok "source synced"

# Force LF on all shell scripts under app/ (Windows checkout may leave CRLF; breaks Linux bash)
Write-Step "Normalize *.sh to LF under app/"
Get-ChildItem -Path $AppDir -Recurse -Filter *.sh -File | ForEach-Object {
  Write-Utf8Lf $_.FullName ([System.IO.File]::ReadAllText($_.FullName))
}
Write-Ok "shell scripts LF-normalized"

$envExample = Join-Path $AppDir ".env.example"
$envLocal = Join-Path $AppDir ".env.local"
$repoEnvLocal = Join-Path $RepoRoot ".env.local"
if (-not (Test-Path $envLocal)) {
  if (Test-Path $repoEnvLocal) {
    Copy-Item $repoEnvLocal $envLocal
    Write-Ok "copied packager .env.local"
  }
  elseif (Test-Path $envExample) {
    Copy-Item $envExample $envLocal
    Write-WarnMsg "using .env.example as temporary .env.local"
  }
  else {
    throw "missing .env.example / .env.local"
  }
}

Write-Step "Download Node v$NodeVersion linux-x64"
$nodeTar = Join-Path $OutDir "node-v$NodeVersion-linux-x64.tar.xz"
$nodeUrl = "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-linux-x64.tar.xz"
if (-not (Test-Path $nodeTar)) {
  Write-Host "GET $nodeUrl"
  Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeTar -UseBasicParsing
}

$extractLines = @(
  '#!/usr/bin/env bash'
  'set -euo pipefail'
  "VER='$NodeVersion'"
  'if ! tar -xJf /dev/null 2>/dev/null; then'
  '  apt-get update -qq && apt-get install -y -qq xz-utils >/dev/null'
  'fi'
  'mkdir -p /out/tools'
  'tar -xJf /out/node-v${VER}-linux-x64.tar.xz -C /out/tools'
  'rm -rf /out/tools/node'
  'mv /out/tools/node-v${VER}-linux-x64 /out/tools/node'
  '/out/tools/node/bin/node -v'
)
$extractSh = Join-Path $OutDir "extract-node.sh"
Write-Utf8Lf $extractSh ($extractLines -join "`n")

docker pull $NodeDockerImage
if ($LASTEXITCODE -ne 0) { throw "docker pull $NodeDockerImage failed" }

docker run --rm -v "${OutDir}:/out" $NodeDockerImage bash /out/extract-node.sh
if ($LASTEXITCODE -ne 0) { throw "extract Node failed" }
Write-Ok "tools/node ready"

Write-Step "Download pnpm v$PnpmVersion (npm tgz + node wrapper)"
$pnpmTgz = Join-Path $OutDir "pnpm-$PnpmVersion.tgz"
$pnpmUrls = @(
  "https://registry.npmmirror.com/pnpm/-/pnpm-$PnpmVersion.tgz",
  "https://registry.npmjs.org/pnpm/-/pnpm-$PnpmVersion.tgz"
)
$got = $false
foreach ($u in $pnpmUrls) {
  try {
    Write-Host "GET $u"
    Invoke-WebRequest -Uri $u -OutFile $pnpmTgz -UseBasicParsing
    if ((Get-Item $pnpmTgz).Length -gt 10000) { $got = $true; break }
  } catch { Write-WarnMsg $_.Exception.Message }
}
if (-not $got) { throw "pnpm tgz download failed" }

$extractPnpm = Join-Path $OutDir "extract-pnpm.sh"
$extractPnpmBody = @(
  '#!/usr/bin/env bash'
  'set -euo pipefail'
  "TGZ='pnpm-$PnpmVersion.tgz'"
  'mkdir -p /out/tools/pnpm-pkg'
  'tar -xzf /out/$TGZ -C /out/tools/pnpm-pkg'
  'test -f /out/tools/pnpm-pkg/package/bin/pnpm.cjs'
) -join "`n"
Write-Utf8Lf $extractPnpm $extractPnpmBody
docker run --rm -v "${OutDir}:/out" $NodeDockerImage bash /out/extract-pnpm.sh
if ($LASTEXITCODE -ne 0) { throw "extract pnpm failed" }

$wrapper = @(
  '#!/usr/bin/env bash'
  'ROOT="$(cd "$(dirname "$0")" && pwd)"'
  'exec "$ROOT/node/bin/node" "$ROOT/pnpm-pkg/package/bin/pnpm.cjs" "$@"'
) -join "`n"
Write-Utf8Lf (Join-Path $ToolsDir "pnpm") $wrapper
Write-Ok "tools/pnpm wrapper ready"

if (-not $SkipPostgresSave) {
  Write-Step "Pull and save $PostgresImage"
  docker pull $PostgresImage
  if ($LASTEXITCODE -ne 0) { throw "docker pull $PostgresImage failed" }
  $pgTar = Join-Path $ImagesDir "postgres17.tar"
  if (Test-Path $pgTar) { Remove-Item -Force $pgTar }
  docker save $PostgresImage -o $pgTar
  if ($LASTEXITCODE -ne 0) { throw "docker save failed" }
  $mb = [math]::Round((Get-Item $pgTar).Length / 1MB, 1)
  Write-Ok "images/postgres17.tar = $mb MB"
}
else {
  Write-WarnMsg "SkipPostgresSave"
}

Write-Step "Linux pnpm install/build in Docker"
$linuxScriptSrc = Join-Path $PSScriptRoot "linux-install-build.sh"
$linuxScriptDst = Join-Path $OutDir "linux-install-build.sh"
Copy-Item $linuxScriptSrc $linuxScriptDst -Force
Write-Utf8Lf $linuxScriptDst ([System.IO.File]::ReadAllText($linuxScriptDst))

$skipVal = if ($SkipBuild) { "1" } else { "0" }
docker run --rm `
  -v "${AppDir}:/app" `
  -v "${ToolsDir}:/tools" `
  -v "${linuxScriptDst}:/linux-install-build.sh:ro" `
  -e NEXT_TELEMETRY_DISABLED=1 `
  -e "SKIP_BUILD=$skipVal" `
  $NodeDockerImage `
  bash /linux-install-build.sh
if ($LASTEXITCODE -ne 0) { throw "Linux install/build failed" }
Write-Ok "linux node_modules ready"

Write-Step "Write bootstrap.sh and README"
Copy-Item (Join-Path $PSScriptRoot "bootstrap.sh") (Join-Path $OutDir "bootstrap.sh") -Force
Write-Utf8Lf (Join-Path $OutDir "bootstrap.sh") ([System.IO.File]::ReadAllText((Join-Path $OutDir "bootstrap.sh")))

$readmeLines = @(
  '# Unified Disc Platform - Offline Bundle'
  ''
  ("Packed at: " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
  ("Node: $NodeVersion linux-x64")
  ("pnpm: $PnpmVersion")
  ("Postgres image: $PostgresImage")
  ''
  '## Server requirements'
  ''
  '- Linux x64'
  '- Docker installed'
  '- No system Node/pnpm required (use tools/)'
  ''
  '## First deploy'
  ''
  '```bash'
  'cd /opt/unified-offline'
  'bash bootstrap.sh'
  '```'
  ''
  'Then edit app/.env.local: PUBLIC_APP_URL, secrets, DB password trio.'
  ''
  '## Reset DB'
  ''
  '```bash'
  'cd /opt/unified-offline/app'
  'export PATH="/opt/unified-offline/tools/node/bin:$PATH"'
  '../tools/pnpm db:down:volumes'
  '../tools/pnpm db:up'
  '../tools/pnpm db:init'
  '```'
  ''
  '## Daily start'
  ''
  '```bash'
  'cd /opt/unified-offline/app'
  'export PATH="/opt/unified-offline/tools/node/bin:$PATH"'
  '../tools/pnpm db:up'
  '../tools/pnpm start'
  '```'
)
Write-Utf8Lf (Join-Path $OutDir "README.md") ($readmeLines -join "`n")

Write-Step "DONE"
Write-Host "Bundle: $OutDir" -ForegroundColor Green
Get-ChildItem $OutDir | Format-Table Name, Mode, Length
