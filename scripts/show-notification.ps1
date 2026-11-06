# Submit a native Windows taskbar notification (Shell NotifyIcon) for one scan.
# No third-party packages, SMTP or Start Menu shortcut registration needed.
# Windows 10 routes these as banners; Windows 11 may show transient banners only.
# Receives JSON on stdin; no scraped text is evaluated as PowerShell code.
$ErrorActionPreference = 'Stop'
$notification = $null
try {
    if ([System.Diagnostics.Process]::GetCurrentProcess().SessionId -eq 0) {
        throw 'This task is in Windows session 0, so no user desktop is available.'
    }
    $raw = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($raw)) { throw 'No notification payload was provided.' }
    $payload = ConvertFrom-Json -InputObject $raw -ErrorAction Stop
    $items = @($payload.items)
    if ($items.Count -lt 1 -or $items.Count -gt 200) { throw 'Invalid notification item count.' }
    $lines = @()
    foreach ($item in ($items | Select-Object -First 3)) {
        $name = ([string]$item.name -replace '[\r\n\t]+', ' ').Trim()
        if ($name.Length -gt 48) { $name = $name.Substring(0, 45) + '...' }
        $price = ([string]$item.price -replace '[\r\n\t]+', ' ').Trim()
        $target = ([string]$item.target -replace '[\r\n\t]+', ' ').Trim()
        $currency = ([string]$item.currency -replace '[\r\n\t]+', ' ').Trim()
        $lines += ('{0}: {1} {2} (target {3})' -f $name, $price, $currency, $target)
    }
    if ($items.Count -gt 3) {
        $lines += ('+{0} more - see Notifications in PriceWatch' -f ($items.Count - 3))
    }
    $message = $lines -join [Environment]::NewLine
    if ($message.Length -gt 245) { $message = $message.Substring(0, 242) + '...' }
    $title = if ($items.Count -eq 1) { 'PriceWatch: price below target' } else {
        'PriceWatch: {0} prices below target' -f $items.Count
    }

    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $notification = New-Object System.Windows.Forms.NotifyIcon
    $notification.Icon = [System.Drawing.SystemIcons]::Information
    $notification.Text = 'PriceWatch'
    $notification.Visible = $true
    [System.Windows.Forms.Application]::DoEvents()
    $notification.ShowBalloonTip(8000, $title, $message,
        [System.Windows.Forms.ToolTipIcon]::Info)
    # NotifyIcon needs its hidden window to process shell messages. Keep the
    # interactive process alive briefly rather than immediately disposing it.
    $until = [DateTime]::UtcNow.AddSeconds(9)
    while ([DateTime]::UtcNow -lt $until) {
        [System.Windows.Forms.Application]::DoEvents()
        Start-Sleep -Milliseconds 100
    }
    Write-Output 'Notification submitted to Windows Shell.'
} catch {
    [Console]::Error.WriteLine(('Windows notification error: {0}' -f $_.Exception.Message))
    exit 1
} finally {
    if ($null -ne $notification) {
        $notification.Visible = $false
        $notification.Dispose()
    }
}
