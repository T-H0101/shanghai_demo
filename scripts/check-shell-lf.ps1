#Requires -Version 5.1
<#
.SYNOPSIS
  Scan (and optionally fix) CRLF in shell scripts. Linux/Docker bash fails on CRLF
  (e.g. `set: pipefail: invalid option name`).

.EXAMPLE
  powershell -File scripts/check-shell-lf.ps1
  powershell -File scripts/check-shell-lf.ps1 -Fix
#>
param(
  [switch]$Fix,
  [string]$Root = ""
)

$ErrorActionPreference = "Stop"
if (-not $Root) {
  $Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

$utf8 = New-Object System.Text.UTF8Encoding $false
$bad = @()
$ok = 0

$files = @(
  (Get-ChildItem -Path (Join-Path $Root "scripts") -Recurse -Include *.sh,*.bash -File -ErrorAction SilentlyContinue)
  (Get-ChildItem -Path (Join-Path $Root "databases") -Recurse -Include *.sh,*.bash -File -ErrorAction SilentlyContinue)
  (Get-ChildItem -Path (Join-Path $Root "bs") -Recurse -Include *.sh,*.bash,*.service,*.env -File -ErrorAction SilentlyContinue)
  (Get-ChildItem -Path (Join-Path $Root "deploy") -Recurse -Include *.sh,*.bash,*.service,*.env -File -ErrorAction SilentlyContinue)
  (Get-ChildItem -Path $Root -Filter "*.sh" -File -ErrorAction SilentlyContinue)
) | Where-Object { $_ } | Sort-Object -Property FullName -Unique

foreach ($f in $files) {
  $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
  $hasCR = ($bytes -contains 13)
  $rel = $f.FullName.Substring($Root.Length).TrimStart('\', '/')
  if ($hasCR) {
    $bad += $rel
    if ($Fix) {
      $text = [System.IO.File]::ReadAllText($f.FullName)
      $n = $text -replace "`r`n", "`n" -replace "`r", "`n"
      if (-not $n.EndsWith("`n")) { $n += "`n" }
      [System.IO.File]::WriteAllText($f.FullName, $n, $utf8)
      Write-Host "[FIXED] $rel" -ForegroundColor Yellow
    } else {
      Write-Host "[CRLF]  $rel" -ForegroundColor Red
    }
  } else {
    $ok++
  }
}

Write-Host ""
Write-Host "LF ok: $ok  CRLF: $($bad.Count)" -ForegroundColor Cyan
if ($bad.Count -gt 0 -and -not $Fix) {
  Write-Host "Run with -Fix to convert, or ensure .gitattributes *.sh eol=lf then: git add --renormalize ." -ForegroundColor Yellow
  exit 1
}
if ($Fix -and $bad.Count -gt 0) {
  Write-Host "Converted $($bad.Count) file(s) to LF." -ForegroundColor Green
}
exit 0
