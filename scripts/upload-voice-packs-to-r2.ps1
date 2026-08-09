[CmdletBinding()]
param(
    [string]$AccountId = $env:R2_ACCOUNT_ID,
    [string]$AccessKeyId = $env:R2_ACCESS_KEY_ID,
    [string]$SecretAccessKey = $env:R2_SECRET_ACCESS_KEY,
    [string]$Bucket = $env:R2_BUCKET,
    [string]$PublicBaseUrl = $env:R2_PUBLIC_BASE_URL,
    [int]$Transfers = 16,
    [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$VoiceRoot = Join-Path $ProjectRoot "public\audio\voices"
$RemoteName = "japaneseR2"

function Assert-Value([string]$Name, [string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "Missing $Name. Set it as a parameter or environment variable."
    }
}

Assert-Value "R2_ACCOUNT_ID" $AccountId
Assert-Value "R2_ACCESS_KEY_ID" $AccessKeyId
Assert-Value "R2_SECRET_ACCESS_KEY" $SecretAccessKey
Assert-Value "R2_BUCKET" $Bucket

if (-not (Test-Path -LiteralPath $VoiceRoot)) {
    throw "Voice root not found: $VoiceRoot"
}

$LocalRclone = Join-Path $ProjectRoot "tools\rclone\rclone.exe"
$RclonePath = if (Test-Path -LiteralPath $LocalRclone) {
    $LocalRclone
} else {
    (Get-Command rclone -ErrorAction SilentlyContinue).Source
}
if ([string]::IsNullOrWhiteSpace($RclonePath)) {
    throw "rclone was not found. Install rclone 1.59 or newer, then run this script again."
}

$VoiceDirectories = @(Get-ChildItem -LiteralPath $VoiceRoot -Directory | Where-Object {
    Test-Path -LiteralPath (Join-Path $_.FullName "manifest.json")
})
if ($VoiceDirectories.Count -eq 0) {
    throw "No voice packs with manifest.json were found under $VoiceRoot"
}

$ConfigPrefix = "RCLONE_CONFIG_JAPANESER2_"
$ConfigValues = @{
    "${ConfigPrefix}TYPE" = "s3"
    "${ConfigPrefix}PROVIDER" = "Cloudflare"
    "${ConfigPrefix}ACCESS_KEY_ID" = $AccessKeyId
    "${ConfigPrefix}SECRET_ACCESS_KEY" = $SecretAccessKey
    "${ConfigPrefix}ENDPOINT" = "https://$AccountId.r2.cloudflarestorage.com"
    "${ConfigPrefix}ACL" = "private"
    "${ConfigPrefix}NO_CHECK_BUCKET" = "true"
}
$PreviousValues = @{}

try {
    foreach ($Entry in $ConfigValues.GetEnumerator()) {
        $PreviousValues[$Entry.Key] = [Environment]::GetEnvironmentVariable($Entry.Key, "Process")
        [Environment]::SetEnvironmentVariable($Entry.Key, $Entry.Value, "Process")
    }

    foreach ($VoiceDirectory in $VoiceDirectories) {
        $VoiceId = $VoiceDirectory.Name
        $RemotePath = "${RemoteName}:$Bucket/voices/$VoiceId"
        Write-Host "[$VoiceId] source: $($VoiceDirectory.FullName)"
        Write-Host "[$VoiceId] remote: $RemotePath"

        if (-not $CheckOnly) {
            & $RclonePath copy $VoiceDirectory.FullName $RemotePath `
                --config NUL `
                --transfers $Transfers `
                --checkers ($Transfers * 2) `
                --include "*.wav" `
                --include "manifest.json" `
                --include "generation-report.json" `
                --header-upload "Cache-Control: public, max-age=31536000, immutable" `
                --progress
            if ($LASTEXITCODE -ne 0) {
                throw "rclone upload failed for $VoiceId with exit code $LASTEXITCODE"
            }
        }

        & $RclonePath check $VoiceDirectory.FullName $RemotePath `
            --config NUL `
            --checkers ($Transfers * 2) `
            --include "*.wav" `
            --include "manifest.json" `
            --include "generation-report.json" `
            --size-only `
            --one-way
        if ($LASTEXITCODE -ne 0) {
            throw "rclone verification failed for $VoiceId with exit code $LASTEXITCODE"
        }
    }

    $IndexPath = Join-Path $VoiceRoot "index.json"
    if (-not $CheckOnly -and (Test-Path -LiteralPath $IndexPath)) {
        & $RclonePath copyto $IndexPath "${RemoteName}:$Bucket/voices/index.json" `
            --config NUL `
            --header-upload "Cache-Control: public, max-age=300"
        if ($LASTEXITCODE -ne 0) {
            throw "Could not upload voices/index.json"
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($PublicBaseUrl)) {
        $BaseUrl = $PublicBaseUrl.TrimEnd("/")
        foreach ($VoiceDirectory in $VoiceDirectories) {
            $Sample = Get-ChildItem -LiteralPath $VoiceDirectory.FullName -Recurse -File -Filter "*.wav" | Select-Object -First 1
            if (-not $Sample) { continue }
            $RelativeSample = $Sample.FullName.Substring($VoiceDirectory.FullName.Length).TrimStart("\").Replace("\", "/")
            $SampleUrl = "$BaseUrl/$($VoiceDirectory.Name)/$RelativeSample"
            Write-Host "Checking public URL: $SampleUrl"
            $Response = Invoke-WebRequest -Uri $SampleUrl -Method Head -Headers @{ Origin = "https://chopenguin.github.io" }
            if ($Response.StatusCode -ne 200) {
                throw "Public URL returned HTTP $($Response.StatusCode): $SampleUrl"
            }
        }
    }

    Write-Host "R2 voice-pack upload and verification completed."
}
finally {
    foreach ($Entry in $PreviousValues.GetEnumerator()) {
        [Environment]::SetEnvironmentVariable($Entry.Key, $Entry.Value, "Process")
    }
}
