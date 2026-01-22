$ErrorActionPreference = 'Stop'

$hostsPath = Join-Path $env:SystemRoot 'System32\drivers\etc\hosts'
$desired = @(
  '127.0.0.1 www.gestionale.studiocapoferri.it'
  '127.0.0.1 www.personaltracker.it'
)

$content = Get-Content -Path $hostsPath -ErrorAction Stop
$filtered = $content | Where-Object {
  $_ -notmatch '^\s*127\.0\.0\.1\s+www\.gestionale\.studiocapoferri\.(eu|it)\s*$' -and
  $_ -notmatch '^\s*127\.0\.0\.1\s+www\.personaltracker\.it\s*$'
}

$updated = @()
$updated += $filtered
$updated += ''
$updated += $desired

Set-Content -Path $hostsPath -Value $updated -Encoding ASCII
