# 批量去除 JSON 文件开头的 UTF-8 BOM
# PowerShell 的 [Encoding]::UTF8 默认会写 BOM,会导致 Node JSON.parse 失败

param(
    [string]$Root = "."
)

$count = 0
$fixed = @()

Get-ChildItem -Path $Root -Recurse -File -Filter "*.json" -ErrorAction SilentlyContinue | Where-Object {
    $_.FullName -notmatch '[/\\]\.git' -and
    $_.FullName -notmatch '[/\\]node_modules' -and
    $_.FullName -notmatch '[/\\]build' -and
    $_.FullName -notmatch '[/\\]dist' -and
    $_.FullName -notmatch '[/\\]\.dart_tool' -and
    $_.FullName -notmatch 'pnpm-lock' -and
    $_.FullName -notmatch 'package-lock'
} | ForEach-Object {
    $f = $_.FullName
    $bytes = [System.IO.File]::ReadAllBytes($f)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        # 去掉前 3 字节 BOM
        $newBytes = $bytes[3..($bytes.Length - 1)]
        [System.IO.File]::WriteAllBytes($f, $newBytes)
        $count++
        $fixed += $f.Replace((Get-Location).Path + '\', '')
    }
}

Write-Host "✓ 去除 BOM: $count 个文件"
$fixed | ForEach-Object { Write-Host "  $_" }
