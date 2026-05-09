
$sourceDir = "c:\Users\Tien\university\TTCS\do_an_cuoi_ky\Poliwise"
$backupDir = "c:\Users\Tien\university\TTCS\do_an_cuoi_ky\Poliwise\environment_setup"

if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir
}

# Find all .env files
$envFiles = Get-ChildItem -Path $sourceDir -Filter ".env*" -Recurse -ErrorAction SilentlyContinue

foreach ($file in $envFiles) {
    # Skip files already in the backup directory to avoid recursion or duplication
    if ($file.FullName.StartsWith($backupDir)) {
        continue
    }

    # Calculate relative path
    $relativePath = $file.FullName.Substring($sourceDir.Length + 1)
    $destPath = Join-Path $backupDir $relativePath
    $destDir = Split-Path $destPath

    # Create destination directory if it doesn't exist
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force
    }

    # Copy file
    Copy-Item -Path $file.FullName -Destination $destPath -Force
    Write-Host "Copied: $relativePath -> environment_setup/$relativePath"
}
