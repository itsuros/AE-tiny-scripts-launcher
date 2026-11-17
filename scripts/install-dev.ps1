<#
.SYNOPSIS
    AE Tiny Scripts Launcher - Windows 開発環境セットアップスクリプト
.DESCRIPTION
    %APPDATA%\Adobe\CEP\extensions\com.ae.tinyscripts.launcher へジャンクションを作成し、
    CSXS 9〜12 の PlayerDebugMode レジストリを有効化します（管理者権限不要）。
.EXAMPLE
    .\scripts\install-dev.ps1
    .\scripts\install-dev.ps1 -Uninstall
#>

param(
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

$ExtId = "com.ae.tinyscripts.launcher"
$SrcDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ExtensionsRoot = Join-Path $env:APPDATA "Adobe\CEP\extensions"
$TargetDir = Join-Path $ExtensionsRoot $ExtId

function Remove-ExistingTarget {
    param([string]$Path)
    if (Test-Path -LiteralPath $Path) {
        $item = Get-Item -LiteralPath $Path -Force
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            # Junction / Symlink は Delete() でリンクのみ安全に解除する
            $item.Delete()
        } else {
            Remove-Item -LiteralPath $Path -Recurse -Force
        }
    }
}

Write-Host "=== AE Tiny Scripts Launcher Windows Dev Setup ===" -ForegroundColor Cyan

if ($Uninstall) {
    if (Test-Path -LiteralPath $TargetDir) {
        Remove-ExistingTarget -Path $TargetDir
        Write-Host "Removed link/installation at: $TargetDir" -ForegroundColor Yellow
    } else {
        Write-Host "Nothing to remove at: $TargetDir"
    }
    exit 0
}

if (-not (Test-Path -LiteralPath $ExtensionsRoot)) {
    New-Item -ItemType Directory -Path $ExtensionsRoot -Force | Out-Null
}

if (Test-Path -LiteralPath $TargetDir) {
    Write-Host "Removing existing installation at: $TargetDir" -ForegroundColor Yellow
    Remove-ExistingTarget -Path $TargetDir
}

New-Item -ItemType Junction -Path $TargetDir -Target $SrcDir | Out-Null
Write-Host "Linked (Junction) $SrcDir -> $TargetDir" -ForegroundColor Green

# CSXS 9 〜 12 の PlayerDebugMode を有効化 (HKCU 配下のため管理者権限不要)
foreach ($ver in @(9, 10, 11, 12)) {
    $regPath = "HKCU:\Software\Adobe\CSXS.$ver"
    if (-not (Test-Path -LiteralPath $regPath)) {
        New-Item -Path $regPath -Force | Out-Null
    }
    Set-ItemProperty -Path $regPath -Name "PlayerDebugMode" -Value "1" -Type String
}

Write-Host "Enabled PlayerDebugMode for CSXS 9-12 in HKCU:\Software\Adobe\CSXS.*" -ForegroundColor Green
Write-Host "Setup complete! Restart After Effects and open Window > Extensions > AE Tiny Scripts Launcher." -ForegroundColor Cyan
