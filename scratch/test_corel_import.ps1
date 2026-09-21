param(
    [string]$dxfPath
)

try {
    $corel = New-Object -ComObject CorelDRAW.Application
    Write-Host "CorelDRAW Version: $($corel.VersionMajor)"
    
    $doc = $corel.OpenDocument($dxfPath)
    $shapesCount = $doc.ActivePage.Shapes.Count
    Write-Host "File: $dxfPath -> Shapes Count: $shapesCount"
    
    $doc.Close()
} catch {
    Write-Host "Error opening DXF: $($_.Exception.Message)"
}
