# 批量替换 Pairhub -> pairhub (in-place, UTF-8, 跳过二进制和 lockfile)
# 用法: pwsh -File scripts/rebrand/replace-content.ps1

param(
    [string]$Root = "."
)

# 跳过的目录
$skipDirs = @(
    '\.git\', '\.dart_tool\', '\node_modules\', '\build\', '\dist\',
    '[/\\]ios[/\\]Pods\', '[/\\]ios[/\\].symlinks\', '[/\\]android[/\\]\.gradle\',
    '[/\\]android[/\\]app[/\\]build\', '\.idea\', '\.vscode\', '[/\\]caches\',
    '[/\\]logs\?'
)

# 跳过的文件扩展名(二进制)
$skipExt = @(
    'png','jpg','jpeg','gif','webp','ico','bmp','tiff',
    'pdf','zip','tar','gz','7z','rar',
    'ttf','otf','woff','woff2','eot',
    'mp4','mov','mp3','wav','ogg',
    'so','dll','dylib','a','o','class','jar','apk','aab',
    'lock'
)

# 跳过的文件
$skipFiles = @(
    'pnpm-lock.yaml','pubspec.lock','yarn.lock','package-lock.json',
    'Pairhub.bundle'
)

$count = 0
$bytesSaved = 0
$filesChanged = @()

Get-ChildItem -Path $Root -Recurse -File -Force -ErrorAction SilentlyContinue | ForEach-Object {
    $f = $_

    # 跳过目录
    foreach ($sd in $skipDirs) {
        if ($f.FullName -match $sd) { return }
    }

    # 跳过扩展名
    if ($skipExt -contains $f.Extension.TrimStart('.').ToLower()) { return }

    # 跳过特定文件
    if ($skipFiles -contains $f.Name) { return }

    # 跳过图片内容(看头部字节)
    try {
        $bytes = [System.IO.File]::ReadAllBytes($f.FullName) | Select-Object -First 8
        if ($bytes.Length -ge 4) {
            # PNG: 89 50 4E 47
            if ($bytes[0] -eq 0x89 -and $bytes[1] -eq 0x50) { return }
            # JPEG: FF D8
            if ($bytes[0] -eq 0xFF -and $bytes[1] -eq 0xD8) { return }
            # GIF: 47 49 46
            if ($bytes[0] -eq 0x47 -and $bytes[1] -eq 0x49) { return }
            # ZIP/PK: 50 4B
            if ($bytes[0] -eq 0x50 -and $bytes[1] -eq 0x4B) { return }
            # PDF: 25 50 44 46
            if ($bytes[0] -eq 0x25 -and $bytes[1] -eq 0x50 -and $bytes[2] -eq 0x44) { return }
        }
    } catch { return }

    # 读内容
    $content = $null
    try {
        $content = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    } catch {
        # 不是 UTF-8,跳过
        return
    }

    # 必须包含 Pairhub / Pairhub 才处理
    if ($content -notmatch 'Pairhub|Pairhub') { return }

    # 替换(顺序: 先大写后小写, 避免误伤)
    $new = $content
    $new = $new -replace 'Pairhub', 'Pairhub'
    $new = $new -replace 'Pairhub', 'PAIRHUB'
    $new = $new -replace 'Pairhub', 'pairhub'
    $new = $new -replace 'Pair Hub', 'Pair Hub'

    if ($new -ne $content) {
        [System.IO.File]::WriteAllText($f.FullName, $new, [System.Text.Encoding]::UTF8)
        $count++
        $filesChanged += $f.FullName.Substring($PWD.Path.Length + 1)
        $bytesSaved += ($content.Length - $new.Length)
    }
}

Write-Host "✓ 替换完成"
Write-Host "  改动文件: $count"
Write-Host "  节省字节: $bytesSaved"
Write-Host "  修改清单:"
$filesChanged | ForEach-Object { Write-Host "    $_" }
