[CmdletBinding()]
param(
  [string]$TargetDirectory = "Cashly",
  [string]$Branch = "main",
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$repositoryUrl = "https://github.com/satriadinataaa/Cashly.git"
$targetPath = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $TargetDirectory))

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git belum terpasang atau tidak ditemukan di PATH."
}

if (Test-Path -LiteralPath $targetPath) {
  $existingItems = @(Get-ChildItem -LiteralPath $targetPath -Force)
  if ($existingItems.Count -gt 0) {
    throw "Folder tujuan sudah ada dan tidak kosong: $targetPath"
  }
}

Write-Host "Mengunduh Cashly branch $Branch..." -ForegroundColor Cyan
git clone --branch $Branch --single-branch $repositoryUrl $targetPath
if ($LASTEXITCODE -ne 0) {
  throw "Git clone gagal dengan exit code $LASTEXITCODE."
}

if (-not $SkipInstall) {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Repository berhasil di-clone, tetapi Node.js belum tersedia di PATH."
  }

  Write-Host "Memasang dependency..." -ForegroundColor Cyan
  & npm.cmd install --prefix $targetPath
  if ($LASTEXITCODE -ne 0) {
    throw "npm install gagal dengan exit code $LASTEXITCODE."
  }
}

$environmentExample = Join-Path $targetPath ".env.example"
$environmentFile = Join-Path $targetPath ".env"
if ((Test-Path -LiteralPath $environmentExample) -and -not (Test-Path -LiteralPath $environmentFile)) {
  Copy-Item -LiteralPath $environmentExample -Destination $environmentFile
  Write-Host ".env dibuat dari .env.example." -ForegroundColor Green
}

Write-Host ""
Write-Host "Cashly siap di: $targetPath" -ForegroundColor Green
Write-Host "Langkah berikutnya:"
Write-Host "  1. Edit $environmentFile"
Write-Host "  2. cd `"$targetPath`""
Write-Host "  3. npm run db:create"
Write-Host "  4. npm run db:migrate"
Write-Host "  5. npm start"
