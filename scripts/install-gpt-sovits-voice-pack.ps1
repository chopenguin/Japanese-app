[CmdletBinding()]
param(
    [string]$ProjectRoot = "",
    [string]$PackageRoot = "",
    [switch]$SkipCoverageCheck
)

$ErrorActionPreference = "Stop"
$VoiceId = "gpt-sovits-custom"
$InstallerRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Test-ProjectRoot([string]$Path) {
    if ([string]::IsNullOrWhiteSpace($Path)) { return $false }
    return (
        (Test-Path -LiteralPath (Join-Path $Path "package.json")) -and
        (Test-Path -LiteralPath (Join-Path $Path "src\audio.ts")) -and
        (Test-Path -LiteralPath (Join-Path $Path "data\vocabulary\manifest.json")) -and
        (Test-Path -LiteralPath (Join-Path $Path "public\audio\voices\index.json"))
    )
}

function Resolve-ExistingPath([string]$Path) {
    return (Resolve-Path -LiteralPath $Path).Path.TrimEnd('\')
}

if ([string]::IsNullOrWhiteSpace($PackageRoot)) {
    $PackageCandidates = @(
        (Join-Path $InstallerRoot "public\audio\voices\$VoiceId"),
        (Join-Path (Split-Path -Parent $InstallerRoot) "public\audio\voices\$VoiceId")
    )
    $PackageRoot = $PackageCandidates | Where-Object {
        Test-Path -LiteralPath (Join-Path $_ "manifest.json")
    } | Select-Object -First 1
}

if ([string]::IsNullOrWhiteSpace($PackageRoot) -or -not (Test-Path -LiteralPath (Join-Path $PackageRoot "manifest.json"))) {
    throw "Voice package not found. Extract the downloaded zip first, or pass -PackageRoot."
}
$PackageRoot = Resolve-ExistingPath $PackageRoot

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectCandidates = New-Object System.Collections.Generic.List[string]
    $ProjectCandidates.Add((Get-Location).Path)
    $Cursor = $InstallerRoot
    for ($Index = 0; $Index -lt 6; $Index++) {
        $ProjectCandidates.Add($Cursor)
        $Parent = Split-Path -Parent $Cursor
        if ([string]::IsNullOrWhiteSpace($Parent) -or $Parent -eq $Cursor) { break }
        $Cursor = $Parent
    }
    $ProjectCandidates.Add("D:\codex projects\Japanese")
    $ProjectRoot = $ProjectCandidates | Where-Object { Test-ProjectRoot $_ } | Select-Object -First 1
}

if (-not (Test-ProjectRoot $ProjectRoot)) {
    throw "Japanese project not found. Run with -ProjectRoot followed by the project directory."
}
$ProjectRoot = Resolve-ExistingPath $ProjectRoot

$PackManifestPath = Join-Path $PackageRoot "manifest.json"
$PackManifest = Get-Content -LiteralPath $PackManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($PackManifest.id -ne $VoiceId) {
    throw "Unexpected voice id in package manifest: $($PackManifest.id)"
}
$VoiceName = [string]$PackManifest.name
if ([string]::IsNullOrWhiteSpace($VoiceName)) { $VoiceName = "GPT-SoVITS custom voice" }

if (-not $SkipCoverageCheck) {
    $VocabularyPath = Join-Path $ProjectRoot "data\vocabulary\manifest.json"
    $Vocabulary = Get-Content -LiteralPath $VocabularyPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $Missing = New-Object System.Collections.Generic.List[string]
    foreach ($Level in @("N5", "N4", "N3", "N2", "N1")) {
        $Covered = @{}
        foreach ($WordId in @($PackManifest.coverage.$Level)) {
            $Covered[[string]$WordId] = $true
        }
        foreach ($Word in @($Vocabulary.levels.$Level.items)) {
            $WordId = [string]$Word.id
            $SourceWav = Join-Path $PackageRoot "$Level\$WordId.wav"
            if (-not $Covered.ContainsKey($WordId) -or -not (Test-Path -LiteralPath $SourceWav)) {
                $Missing.Add("$Level/$WordId.wav")
                if ($Missing.Count -ge 20) { break }
            }
        }
        if ($Missing.Count -ge 20) { break }
    }
    if ($Missing.Count -gt 0) {
        throw "Voice package is incomplete. First missing files: $($Missing -join ', ')"
    }
}

$DestinationRoot = Join-Path $ProjectRoot "public\audio\voices\$VoiceId"
$DestinationParent = Split-Path -Parent $DestinationRoot
New-Item -ItemType Directory -Path $DestinationParent -Force | Out-Null

$SourceResolved = Resolve-ExistingPath $PackageRoot
$DestinationResolved = $null
if (Test-Path -LiteralPath $DestinationRoot) {
    $DestinationResolved = Resolve-ExistingPath $DestinationRoot
}
if ($SourceResolved -ne $DestinationResolved) {
    New-Item -ItemType Directory -Path $DestinationRoot -Force | Out-Null
    Get-ChildItem -LiteralPath $PackageRoot -Force | Copy-Item -Destination $DestinationRoot -Recurse -Force
}

$VoiceIndexPath = Join-Path $ProjectRoot "public\audio\voices\index.json"
$VoiceIndex = Get-Content -LiteralPath $VoiceIndexPath -Raw -Encoding UTF8 | ConvertFrom-Json
$NewVoice = [pscustomobject]@{
    id = $VoiceId
    name = $VoiceName
    type = "audio-pack"
    manifest = "/audio/voices/$VoiceId/manifest.json"
}
$VoiceIndex.voices = @($VoiceIndex.voices | Where-Object { $_.id -ne $VoiceId }) + @($NewVoice)
$VoiceIndexJson = $VoiceIndex | ConvertTo-Json -Depth 20
[System.IO.File]::WriteAllText($VoiceIndexPath, $VoiceIndexJson + "`n", $Utf8NoBom)

$AudioSourcePath = Join-Path $ProjectRoot "src\audio.ts"
$AudioSource = [System.IO.File]::ReadAllText($AudioSourcePath, [System.Text.Encoding]::UTF8)
$NewLine = if ($AudioSource.Contains("`r`n")) { "`r`n" } else { "`n" }
$TypePattern = '(?m)^export type VoiceId = (?<types>[^;]+);'
$TypeMatch = [regex]::Match($AudioSource, $TypePattern)
if (-not $TypeMatch.Success) {
    throw "Could not find VoiceId in src/audio.ts"
}
if ($TypeMatch.Groups['types'].Value -notmatch [regex]::Escape('"' + $VoiceId + '"')) {
    $Replacement = $TypeMatch.Value.TrimEnd(';') + ' | "' + $VoiceId + '";'
    $AudioSource = $AudioSource.Remove($TypeMatch.Index, $TypeMatch.Length).Insert($TypeMatch.Index, $Replacement)
}

$OptionsStart = $AudioSource.IndexOf("export const voiceOptions: VoiceOption[] = [")
if ($OptionsStart -lt 0) {
    throw "Could not find voiceOptions in src/audio.ts"
}
$OptionsEnd = $AudioSource.IndexOf($NewLine + "];", $OptionsStart)
if ($OptionsEnd -lt 0) {
    throw "Could not find the end of voiceOptions in src/audio.ts"
}
$OptionsBlock = $AudioSource.Substring($OptionsStart, $OptionsEnd - $OptionsStart)
if ($OptionsBlock -notmatch ('id:\s*"' + [regex]::Escape($VoiceId) + '"')) {
    $TsVoiceName = $VoiceName.Replace('\', '\\').Replace('"', '\"')
    $Entry = $NewLine + "  {" +
        $NewLine + "    id: `"$VoiceId`"," +
        $NewLine + "    name: `"$TsVoiceName`"," +
        $NewLine + "    type: `"audio-pack`"," +
        $NewLine + "    format: `"wav`"," +
        $NewLine + "  },"
    $AudioSource = $AudioSource.Insert($OptionsEnd, $Entry)
}
[System.IO.File]::WriteAllText($AudioSourcePath, $AudioSource, $Utf8NoBom)

Write-Host "Installed $VoiceId into: $ProjectRoot"
Write-Host "Audio folder: $DestinationRoot"
Write-Host "Updated: public/audio/voices/index.json"
Write-Host "Updated: src/audio.ts"
