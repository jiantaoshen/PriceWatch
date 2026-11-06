param(
    [ValidateSet('status', 'save', 'run', 'stop', 'enable', 'disable', 'remove')]
    [string]$Operation = 'status',
    [ValidatePattern('^([01]\d|2[0-3]):[0-5]\d$')]
    [string]$At = '09:00',
    [ValidateSet('daily', 'weekly')]
    [string]$Frequency = 'daily',
    [string]$Days = 'Monday',
    [string]$PythonPath = ''
)

# Only manage the task owned by PriceWatch. This script is invoked by the local web UI
# with strictly validated, non-executable arguments. No user supplied script/command.
$ErrorActionPreference = 'Stop'
$taskName = 'PriceWatchLocalScraper'
$taskPath = '\'
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$launcher = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'run-scraper.ps1')).Path
$powerShell = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$weekdays = @('Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')

function Get-ExistingTask {
    Get-ScheduledTask -TaskPath $taskPath -TaskName $taskName -ErrorAction SilentlyContinue
}

# Return a clear mismatch reason instead of silently treating a freshly registered task
# as an unrelated task. Keep the action, identity and privilege checks restrictive.
function Convert-AccountToSid([string]$userId) {
    if ([string]::IsNullOrWhiteSpace($userId)) { return $null }
    if ($userId -match '^S-1-\d+(?:-\d+)+$') { return $userId }
    try {
        $account = [System.Security.Principal.NTAccount]::new($userId)
        return $account.Translate([System.Security.Principal.SecurityIdentifier]).Value
    } catch { return $null }
}

function Test-SamePath([string]$actual, [string]$expected) {
    if ([string]::IsNullOrWhiteSpace($actual) -or -not [IO.Path]::IsPathRooted($actual)) { return $false }
    try {
        # Canonicalize path separators, casing, and any resolvable short paths.
        $canonical = [IO.Path]::GetFullPath($actual)
        if (Test-Path -LiteralPath $canonical) {
            $canonical = (Resolve-Path -LiteralPath $canonical).ProviderPath
        }
        $expectedCanonical = [IO.Path]::GetFullPath($expected)
        if (Test-Path -LiteralPath $expectedCanonical) {
            $expectedCanonical = (Resolve-Path -LiteralPath $expectedCanonical).ProviderPath
        }
        return [string]::Equals($canonical.TrimEnd('\'), $expectedCanonical.TrimEnd('\'),
            [StringComparison]::OrdinalIgnoreCase)
    } catch { return $false }
}

function Get-TaskMismatchReason($task) {
    if ($null -eq $task) { return 'Task not installed.' }
    $actions = @($task.Actions)
    if ($actions.Count -ne 1) { return 'Task has an unexpected number of actions.' }
    $action = $actions[0]
    if (-not (Test-SamePath ([string]$action.Execute) $powerShell)) {
        return 'The task executable is not the PowerShell executable managed by this app.'
    }
    if (-not (Test-SamePath ([string]$action.WorkingDirectory) $root)) {
        return 'The task working directory does not match this copy of PriceWatch. Check whether the project folder was moved.'
    }
    # Only match the exact command shape this application registers. Do not accept
    # arbitrary switches, commands, or a second action.
    $prefix = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{0}" -PythonPath "' -f $launcher
    $arguments = [string]$action.Arguments
    if (-not $arguments.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
        return 'The task launch command differs from the PriceWatch launcher.'
    }
    $remainder = $arguments.Substring($prefix.Length)
    $match = [regex]::Match($remainder, '^([^"\r\n]+)"(?: -DatabasePath "([^"\r\n]+)")?$',
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if (-not $match.Success) { return 'The task Python/database arguments do not match the expected format.' }
    if (-not [IO.Path]::IsPathRooted($match.Groups[1].Value)) {
        return 'The task Python executable path is not absolute.'
    }
    if ($match.Groups[2].Success -and -not [IO.Path]::IsPathRooted($match.Groups[2].Value)) {
        return 'The task database path is not absolute.'
    }
    $principal = $task.Principal
    $taskSid = Convert-AccountToSid ([string]$principal.UserId)
    if ($null -eq $taskSid -or -not [string]::Equals($taskSid, $identity.User.Value,
        [StringComparison]::OrdinalIgnoreCase)) {
        return 'The task Windows account does not match the account running the PriceWatch website.'
    }
    if ([string]$principal.RunLevel -notin @('Limited', 'LeastPrivilege')) {
        return 'The task uses an unexpected privilege level.'
    }
    # PowerShell ScheduledTasks represents this as Interactive; Windows task XML uses
    # InteractiveToken. Treat these equivalent representations the same, but not S4U/Password.
    if ([string]$principal.LogonType -notin @('Interactive', 'InteractiveToken')) {
        return 'The task Windows logon type does not match an interactive user task.'
    }
    return $null
}

function Test-ManagedTask($task) {
    return ($null -eq (Get-TaskMismatchReason $task))
}

function Require-ManagedTask($task) {
    if ($null -eq $task) { throw 'Task not installed. Save a schedule first.' }
    $reason = Get-TaskMismatchReason $task
    if ($null -ne $reason) {
        throw "Cannot control the existing task: $reason No changes were made."
    }
}

function Get-DatabaseFile {
    $candidate = if ($env:PRICEWATCH_SQLITE_PATH) { $env:PRICEWATCH_SQLITE_PATH } else {
        Join-Path $root 'data\pricewatch.sqlite3'
    }
    if (-not [IO.Path]::IsPathRooted($candidate)) { $candidate = Join-Path $root $candidate }
    $candidate = [IO.Path]::GetFullPath($candidate)
    if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
        throw "SQLite database not found: $candidate"
    }
    return $candidate
}

function Get-PythonExecutable {
    if (-not $PythonPath) {
        $venv = Join-Path $root '.venv\Scripts\python.exe'
        if (Test-Path -LiteralPath $venv -PathType Leaf) { $candidate = $venv }
        elseif ($env:PRICEWATCH_PYTHON) { $candidate = $env:PRICEWATCH_PYTHON }
        else {
            $python = Get-Command python.exe -ErrorAction SilentlyContinue
            if (-not $python) { throw 'Python not found. Install Python or set PRICEWATCH_PYTHON before starting the website.' }
            $candidate = $python.Source
        }
    } else { $candidate = $PythonPath }
    # Resolve-Path rejects missing, relative, and non-file python executables.
    if (-not [IO.Path]::IsPathRooted($candidate)) { throw 'Python path must be absolute.' }
    if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { throw "Python not found: $candidate" }
    $resolved = (Resolve-Path -LiteralPath $candidate).Path
    & $resolved -c 'import sqlite3, playwright' 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Python cannot import Playwright. Install scraper/requirements.txt into the selected interpreter.' }
    return $resolved
}

function Get-WeekdayNames($trigger) {
    $value = $trigger.DaysOfWeek
    $result = @()
    $mask = 0
    if ([int]::TryParse([string]$value, [ref]$mask)) {
        for ($i = 0; $i -lt 7; $i++) {
            if (($mask -band (1 -shl $i)) -ne 0) { $result += $weekdays[$i] }
        }
    } else {
        $raw = @($value) -join ','
        foreach ($weekday in $weekdays) {
            if (($raw -split '[,\s]+') -contains $weekday) { $result += $weekday }
        }
    }
    return $result
}

function Describe-Task {
    $task = Get-ExistingTask
    if ($null -eq $task) { return @{ installed = $false; managed = $false } }
    $result = @{
        installed = $true
        managed = [bool](Test-ManagedTask $task)
        mismatchReason = Get-TaskMismatchReason $task
        state = [string]$task.State
        nextRun = $null
        lastRun = $null
        lastResult = $null
        frequency = $null
        at = $null
        days = @()
    }
    try {
        $info = Get-ScheduledTaskInfo -InputObject $task -ErrorAction Stop
        if ($info.NextRunTime.Year -gt 2000) { $result.nextRun = $info.NextRunTime.ToString('o') }
        if ($info.LastRunTime.Year -gt 2000) { $result.lastRun = $info.LastRunTime.ToString('o') }
        $result.lastResult = [int64]$info.LastTaskResult
    } catch { } # A task can exist even if Windows has no run history yet.
    $trigger = @($task.Triggers | Where-Object { $_.Enabled -ne $false } | Select-Object -First 1)
    if ($trigger.Count -gt 0) {
        $first = $trigger[0]
        if ($first.StartBoundary) {
            try { $result.at = ([datetime]::Parse($first.StartBoundary)).ToString('HH:mm') } catch { }
        }
        $type = [string]$first.CimClass.CimClassName
        if ($type -eq 'MSFT_TaskDailyTrigger') { $result.frequency = 'daily' }
        elseif ($type -eq 'MSFT_TaskWeeklyTrigger') {
            $result.frequency = 'weekly'
            $result.days = @(Get-WeekdayNames $first)
        }
    }
    return $result
}

try {
    $existing = Get-ExistingTask
    if ($Operation -eq 'save') {
        if ($null -ne $existing) { Require-ManagedTask $existing }
        $selected = @($Days -split ',')
        if ($selected.Count -lt 1 -or $selected.Count -gt 7 -or
            @($selected | Select-Object -Unique).Count -ne $selected.Count) {
            throw 'Invalid weekly days.'
        }
        foreach ($day in $selected) { if ($weekdays -cnotcontains $day) { throw 'Invalid weekly day.' } }
        $dbPath = Get-DatabaseFile
        $python = Get-PythonExecutable
        $arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{0}" -PythonPath "{1}" -DatabasePath "{2}"' -f $launcher, $python, $dbPath
        $action = New-ScheduledTaskAction -Execute $powerShell -Argument $arguments -WorkingDirectory $root
        $date = [datetime]::ParseExact($At, 'HH:mm', [Globalization.CultureInfo]::InvariantCulture)
        if ($Frequency -eq 'weekly') {
            $names = [System.DayOfWeek[]]@($selected | ForEach-Object { [System.DayOfWeek] $_ })
            $trigger = New-ScheduledTaskTrigger -Weekly -At $date -DaysOfWeek $names -WeeksInterval 1
        } else {
            $trigger = New-ScheduledTaskTrigger -Daily -At $date -DaysInterval 1
        }
        $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew `
            -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2)
        $principal = New-ScheduledTaskPrincipal -UserId $identity.Name -LogonType Interactive -RunLevel Limited
        Register-ScheduledTask -TaskName $taskName -TaskPath $taskPath -Action $action `
            -Trigger $trigger -Settings $settings -Principal $principal `
            -Description 'PriceWatch local scraper - managed in the Schedule tab' -Force | Out-Null
        # A successful Register-ScheduledTask does not guarantee our ownership check
        # recognizes the stored task. Never claim installation succeeded in that case.
        $registered = Get-ExistingTask
        Require-ManagedTask $registered
    } elseif ($Operation -ne 'status') {
        Require-ManagedTask $existing
        switch ($Operation) {
            'run'     { Start-ScheduledTask -InputObject $existing }
            'stop'    { Stop-ScheduledTask -InputObject $existing }
            'enable'  { Enable-ScheduledTask -InputObject $existing | Out-Null }
            'disable' { Disable-ScheduledTask -InputObject $existing | Out-Null }
            'remove'  { Unregister-ScheduledTask -InputObject $existing -Confirm:$false }
        }
    }
    Describe-Task | ConvertTo-Json -Compress -Depth 6
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
