$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceRoot = Join-Path $scriptRoot '..\init-db'
$outputRoot = Join-Path $scriptRoot 'sql'

New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null

$v1Files = @(
  '000_bootstrap.sql'
  '001_core.sql'
  '002_metadata.sql'
  '003_knowledge.sql'
  '004_conversation.sql'
  '005_analytics.sql'
  '006_functions_triggers.sql'
  '007_seed_data.sql'
  '008_ai_indexes.sql'
  'migrations/001_bm25_simple_dictionary.sql'
  'migrations/002_fk_constraints_and_improvements.sql'
)

$v1Parts = foreach ($relativePath in $v1Files) {
  $fullPath = Join-Path $sourceRoot $relativePath
  if (-not (Test-Path $fullPath)) {
    throw "Missing Flyway source file: $relativePath"
  }

  @(
    "-- ===================================================================="
    "-- Source: $relativePath"
    "-- ===================================================================="
    (Get-Content -Raw -LiteralPath $fullPath)
    ""
  ) -join [Environment]::NewLine
}

Set-Content -LiteralPath (Join-Path $outputRoot 'V1__baseline.sql') -Value ($v1Parts -join [Environment]::NewLine) -Encoding utf8

$v2Source = Join-Path $sourceRoot '009_document_locks.sql'
if (-not (Test-Path $v2Source)) {
  throw 'Missing Flyway V2 source file: 009_document_locks.sql'
}

 $v2Content = @(
  '-- ===================================================================='
  '-- Source: 009_document_locks.sql'
  '-- ===================================================================='
  (Get-Content -Raw -LiteralPath $v2Source)
 ) -join [Environment]::NewLine

Set-Content -LiteralPath (Join-Path $outputRoot 'V2__onlyoffice_locks.sql') -Value $v2Content -Encoding utf8

Write-Host "Generated Flyway migrations in $outputRoot"
