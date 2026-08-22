param([int]$SourceYear = 2025)

$ErrorActionPreference = "Stop"
$headers = @{ "User-Agent" = "RacecraftAnalytics/0.1" }
$sessionMap = @{
  "Melbourne" = "albert-park"; "Shanghai" = "shanghai"; "Suzuka" = "suzuka"; "Miami" = "miami"
  "Monte Carlo" = "monaco"; "Catalunya" = "catalunya"; "Montreal" = "villeneuve"; "Spielberg" = "red-bull-ring"
  "Silverstone" = "silverstone"; "Spa-Francorchamps" = "spa"; "Hungaroring" = "hungaroring"; "Zandvoort" = "zandvoort"
  "Monza" = "monza"; "Baku" = "baku"; "Singapore" = "marina-bay"; "Austin" = "americas"
  "Mexico City" = "rodriguez"; "Interlagos" = "interlagos"; "Las Vegas" = "vegas"; "Lusail" = "losail"
  "Yas Marina Circuit" = "yas-marina"
}

function NumberText([double]$value) { return $value.ToString("0.##", [Globalization.CultureInfo]::InvariantCulture) }
function Expand-ApiRows($payload) {
  $items = @($payload)
  if ($items.Count -eq 1 -and $items[0].PSObject.Properties.Name -contains "date_start" -and $items[0].date_start -is [array]) {
    $columnar = $items[0]; $count = $columnar.date_start.Count
    for ($i = 0; $i -lt $count; $i++) {
      $row = @{}
      foreach ($property in $columnar.PSObject.Properties) {
        $value = $property.Value
        $row[$property.Name] = if ($value -is [array]) { $value[$i] } else { $value }
      }
      [pscustomobject]$row
    }
    return
  }
  return $items
}
function Get-OpenF1Rows([string]$uri) {
  for ($attempt = 0; $attempt -lt 4; $attempt++) {
    try {
      $payload = Invoke-RestMethod -Uri $uri -Headers $headers
      Start-Sleep -Milliseconds 1100
      return @(Expand-ApiRows $payload)
    } catch {
      if ($attempt -eq 3) { throw }
      Start-Sleep -Seconds ([math]::Min(8, 2 + $attempt * 2))
    }
  }
}
function Get-SmoothPath($points) {
  # OpenF1 can return a complete location stream with zero coordinates when a
  # driver's telemetry is unavailable. Never turn that stream into a visible
  # but invalid point by normalising it around the centre of the viewBox.
  $usable = @($points | Where-Object {
    $x = [double]$_.x; $y = [double]$_.y
    -not [double]::IsNaN($x) -and -not [double]::IsNaN($y) -and ($x -ne 0 -or $y -ne 0)
  })
  if ($usable.Count -lt 12) { return $null }
  $ordered = @($usable | Sort-Object {[datetime]$_.date})
  $stride = [math]::Max(1, [math]::Ceiling($ordered.Count / 140))
  $sampled = for ($i = 0; $i -lt $ordered.Count; $i += $stride) { $ordered[$i] }
  if ($sampled.Count -lt 12) { return $null }
  $minX = ($sampled | Measure-Object x -Minimum).Minimum; $maxX = ($sampled | Measure-Object x -Maximum).Maximum
  $minY = ($sampled | Measure-Object y -Minimum).Minimum; $maxY = ($sampled | Measure-Object y -Maximum).Maximum
  if (($maxX - $minX) -lt 20 -or ($maxY - $minY) -lt 20) { return $null }
  $rangeX = [math]::Max(1, $maxX - $minX); $rangeY = [math]::Max(1, $maxY - $minY)
  $scale = [math]::Min(150 / $rangeX, 100 / $rangeY)
  $offsetX = 95 - (($minX + $maxX) * $scale / 2); $offsetY = 70 + (($minY + $maxY) * $scale / 2)
  $xy = @($sampled | ForEach-Object { ,@((($_.x * $scale) + $offsetX), ($offsetY - ($_.y * $scale))) })
  $result = "M $(NumberText $xy[0][0]) $(NumberText $xy[0][1])"
  for ($i = 1; $i -lt $xy.Count - 1; $i++) {
    $midX = ($xy[$i][0] + $xy[$i + 1][0]) / 2; $midY = ($xy[$i][1] + $xy[$i + 1][1]) / 2
    $result += " Q $(NumberText $xy[$i][0]) $(NumberText $xy[$i][1]) $(NumberText $midX) $(NumberText $midY)"
  }
  $last = $xy[$xy.Count - 1]; $first = $xy[0]
  $result += " Q $(NumberText $last[0]) $(NumberText $last[1]) $(NumberText $first[0]) $(NumberText $first[1]) Z"
  return $result
}

$sessions = @(Get-OpenF1Rows "https://api.openf1.org/v1/sessions?year=$SourceYear")
$races = @($sessions | Where-Object { $_.session_name -eq "Race" -and $sessionMap.ContainsKey($_.circuit_short_name) } | Group-Object circuit_short_name | ForEach-Object { $_.Group | Select-Object -First 1 })
$paths = [ordered]@{}
$driverCandidates = @(1, 4, 44, 16, 63, 81, 55)
foreach ($race in $races) {
  $slug = $sessionMap[$race.circuit_short_name]
  $path = $null
  foreach ($driverNumber in $driverCandidates) {
    Write-Host "Fetching $($race.circuit_short_name) -> $slug with driver $driverNumber (session $($race.session_key))"
    $laps = @(Get-OpenF1Rows "https://api.openf1.org/v1/laps?session_key=$($race.session_key)&driver_number=$driverNumber")
    $lap = $laps | Where-Object { $_.lap_duration -gt 55 -and $_.lap_duration -lt 180 } | Sort-Object lap_duration | Select-Object -First 1
    if (-not $lap) { continue }
    $start = [datetime]$lap.date_start; $finish = $start.AddSeconds([double]$lap.lap_duration)
    $from = [uri]::EscapeDataString($start.ToString("o")); $to = [uri]::EscapeDataString($finish.ToString("o"))
    $locationUrl = "https://api.openf1.org/v1/location?session_key=$($race.session_key)&driver_number=$driverNumber&date%3E=$from&date%3C=$to"
    $locations = @(Get-OpenF1Rows $locationUrl)
    $path = Get-SmoothPath $locations
    if ($path) {
      $paths[$slug] = $path
      break
    }
  }
  if (-not $path) { Write-Warning "Insufficient valid location points for $slug" }
}

# These 2026 calendar entries have no 2025 F1 race telemetry. Keep visibly unique,
# deterministic fallback silhouettes until their first session is ingested.
$paths["sepang"] = "M22 96 C30 80 36 65 51 60 C66 55 80 66 94 72 C112 83 133 84 153 74 C169 66 174 48 161 38 C146 27 128 36 115 48 C99 63 85 48 77 35 C67 18 48 16 35 27 C24 37 31 49 45 50 C63 51 72 40 84 28 C97 14 122 13 143 22 C166 32 180 50 173 67 C166 85 147 96 128 97 C106 98 91 87 74 81 C58 75 42 82 31 97 C27 103 24 102 22 96 Z"
$paths["madring"] = "M 22 73 C 21 67 16 64 13 61 C 9 57 9 50 12 46 C 15 42 19 41 23 38 L 56 17 C 65 12 74 11 80 15 C 84 18 88 18 91 15 C 95 12 99 15 103 12 C 108 9 113 6 119 8 C 122 10 125 8 128 8 L 145 8 C 151 8 156 11 160 14 C 166 19 174 19 179 23 C 185 28 187 36 184 43 C 181 50 175 54 168 54 C 161 54 156 50 151 46 L 134 31 C 130 28 127 27 124 30 L 116 38 C 113 41 108 43 103 43 L 96 43 C 91 43 88 47 88 52 L 89 60 C 89 64 87 67 83 70 L 75 76 C 72 78 71 81 72 85 L 73 91 C 74 96 71 99 66 100 L 55 102 C 51 103 49 106 50 110 L 51 116 C 51 119 49 121 46 122 L 26 126 C 23 127 21 125 21 122 L 22 73 Z"

$lines = @("// Generated by scripts/refresh-circuit-geometry.ps1 from OpenF1 Race fastest-lap location data.", "// Do not hand-edit; rerun the script when a newer validated geometry source is available.", "export const circuitPaths: Record<string, string> = {")
foreach ($entry in $paths.GetEnumerator()) { $escaped = $entry.Value.Replace("'", "\\'"); $lines += "  '$($entry.Key)': '$escaped'," }
$lines += "};"
Set-Content -LiteralPath "src/lib/circuit-paths.ts" -Value ($lines -join [Environment]::NewLine) -Encoding utf8
Write-Host "Wrote $($paths.Count) circuit paths to src/lib/circuit-paths.ts"
