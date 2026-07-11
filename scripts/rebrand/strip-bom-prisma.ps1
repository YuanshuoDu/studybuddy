# 去除 .prisma 文件开头的 UTF-8 BOM
# Prisma 5 的 wasm validator 不接受 BOM,会报 P1012 schema validation error

param(
    [string]$Root = "."
)

$count = 0
$fixed = @()

Get-ChildItem -Path $Root -Recurse -File -Filter "*.prisma" -ErrorAction SilentlyContinue | ForEach-Object {
    $f = $_.FullName
    $bytes = [System.IO.File]::ReadAllBytes($f)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $newBytes = $bytes[3..($bytes.Length - 1)]
        [System.IO.File]::WriteAllBytes($f, $newBytes)
        $count++
        $fixed += $f.Replace((Get-Location).Path + '\', '')
    }
}

Write-Host "✓ 去除 .prisma BOM: $count 个文件"
$fixed | ForEach-Object { Write-Host "  $_" }
