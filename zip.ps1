$source = "x:\time-snap"
$zipFile = "x:\time-snap\time-snap.zip"

# If the zip exists, remove it
if (Test-Path $zipFile) { Remove-Item $zipFile }

# Get all items except 'docs' and hidden folders
$items = Get-ChildItem -Path $source -Exclude 'docs' -Force | Where-Object {
    $_.PSIsContainer -eq $false -or ($_.PSIsContainer -eq $true -and $_.Name -notmatch '^\.')
}

# Ignore this file
$ignoreFile = Join-Path -Path $source -ChildPath "zip.ps1"
$items = $items | Where-Object { $_.FullName -ne $ignoreFile }


# Remove existing zip if present
if (Test-Path $zipFile) { Remove-Item $zipFile }

# Create the zip
Compress-Archive -Path $items.FullName -DestinationPath $zipFile