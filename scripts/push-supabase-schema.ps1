param(
  [string]$EnvFile = ".env.supabase.local"
)

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envPath = Join-Path $projectRoot $EnvFile

if (-not (Test-Path -LiteralPath $envPath)) {
  throw "Supabase env file was not found: $envPath"
}

$previousDatabaseUrl = [Environment]::GetEnvironmentVariable("DATABASE_URL", "Process")

try {
  $databaseUrlLine = Get-Content -LiteralPath $envPath |
    Where-Object { $_ -match "^\s*DATABASE_URL\s*=" } |
    Select-Object -First 1

  if (-not $databaseUrlLine) {
    throw "DATABASE_URL was not found in $EnvFile."
  }

  $databaseUrl = ($databaseUrlLine -replace "^\s*DATABASE_URL\s*=", "").Trim()
  $databaseUrl = $databaseUrl.Trim('"').Trim("'")

  if (-not $databaseUrl) {
    throw "DATABASE_URL in $EnvFile is empty."
  }

  [Environment]::SetEnvironmentVariable("DATABASE_URL", $databaseUrl, "Process")

  Push-Location $projectRoot
  try {
    corepack pnpm db:push
  }
  finally {
    Pop-Location
  }
}
finally {
  if ($null -eq $previousDatabaseUrl) {
    [Environment]::SetEnvironmentVariable("DATABASE_URL", $null, "Process")
  }
  else {
    [Environment]::SetEnvironmentVariable("DATABASE_URL", $previousDatabaseUrl, "Process")
  }
}
