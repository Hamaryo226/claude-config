# 会社 PC の ~/.claude へこのプロファイルを配置する (Windows / PowerShell)。
#
#   .\install.ps1              # 差分を表示するだけ (何も書き換えない)
#   .\install.ps1 -Apply       # 実際に配置する
#
# 既存ファイルは上書き前に .bak-<日時> として退避する。
[CmdletBinding()]
param(
    [switch]$Apply,
    [string]$Target = (Join-Path $env:USERPROFILE ".claude")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Source = $PSScriptRoot
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

# 配置するもの。ここに無いものは触らない。
$Items = @(
    'CLAUDE.md',
    'settings.json',
    'statusline.mjs',
    'agents',
    'hooks',
    'rules',
    'skills'
)

Write-Host "配置元: $Source"
Write-Host "配置先: $Target"
if (-not $Apply) { Write-Host "`n[dry-run] -Apply を付けると実際に書き込みます。`n" -ForegroundColor Yellow }

if (-not (Test-Path $Target)) {
    Write-Host "作成: $Target"
    if ($Apply) { New-Item -ItemType Directory -Path $Target -Force | Out-Null }
}

foreach ($item in $Items) {
    $src = Join-Path $Source $item
    $dst = Join-Path $Target $item
    if (-not (Test-Path $src)) { Write-Warning "配置元に無い: $item"; continue }

    if (Test-Path $dst) {
        $backup = "$dst.bak-$Stamp"
        Write-Host "退避: $item -> $(Split-Path $backup -Leaf)" -ForegroundColor DarkGray
        if ($Apply) { Move-Item -Path $dst -Destination $backup }
    }
    Write-Host "配置: $item" -ForegroundColor Green
    if ($Apply) { Copy-Item -Path $src -Destination $dst -Recurse }
}

# settings.json のプレースホルダを実際のパスに置き換える。
# フックの args は絶対パスでないと解決されないため、この置換が必須。
$settings = Join-Path $Target 'settings.json'
$targetForward = $Target -replace '\\', '/'
Write-Host "`nsettings.json の __CLAUDE_DIR__ を '$targetForward' に置換" -ForegroundColor Green
if ($Apply) {
    if (-not (Test-Path $settings)) { throw "settings.json が見つかりません: $settings" }
    $content = Get-Content -Path $settings -Raw -Encoding UTF8
    $content = $content -replace '__CLAUDE_DIR__', $targetForward
    Set-Content -Path $settings -Value $content -Encoding UTF8 -NoNewline

    # 置き換え漏れが無いか検証する
    if ((Get-Content -Path $settings -Raw -Encoding UTF8) -match '__CLAUDE_DIR__') {
        throw "__CLAUDE_DIR__ が残っています。settings.json を確認してください。"
    }
    # JSON として壊れていないか検証する
    Get-Content -Path $settings -Raw -Encoding UTF8 | ConvertFrom-Json | Out-Null
    Write-Host "settings.json は有効な JSON です" -ForegroundColor Green
}

if ($Apply) {
    Write-Host "`n完了。次にやること:" -ForegroundColor Cyan
    Write-Host "  1. CLAUDE.md の『この環境について (要記入)』を埋める"
    Write-Host "  2. settings.json の permissions.allow の WebFetch に社内ドキュメントのドメインを足す"
    Write-Host "  3. 新しいセッションを開いて /status と /context を確認する"
    Write-Host "  4. claude doctor でエラーが無いことを確認する"
} else {
    Write-Host "`n[dry-run] 何も変更していません。" -ForegroundColor Yellow
}
