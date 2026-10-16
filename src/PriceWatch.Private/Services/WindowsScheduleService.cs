using System.Diagnostics;
using System.Globalization;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using PriceWatch.Private.Models;

namespace PriceWatch.Private.Services;

public sealed class WindowsScheduleService
{
    private const string TaskName = "PriceWatch Private Scrape";

    private readonly PrivatePaths _paths;
    private readonly PrivateSettings _settings;

    public WindowsScheduleService(
        PrivatePaths paths,
        IOptions<PrivateSettings> settings)
    {
        _paths = paths;
        _settings = settings.Value;
    }

    public async Task<ScheduleStatus> GetAsync()
    {
        var request = await ReadConfigAsync()
                      ?? new ScheduleRequest();

        return new ScheduleStatus(
            TaskExists: await TaskExistsAsync(),
            Enabled: request.Enabled,
            Day: request.Day,
            Time: request.Time,
            RunIfMissed: request.RunIfMissed);
    }

    public async Task<ScheduleStatus> ApplyAsync(
        ScheduleRequest request)
    {
        EnsureWindows();
        ValidateRequest(request);

        if (!request.Enabled)
        {
            await DeleteTaskAsync();
            await SaveConfigAsync(request);
            return await GetAsync();
        }

        var day = Enum.Parse<DayOfWeek>(
            request.Day,
            ignoreCase: true);

        var time = TimeOnly.ParseExact(
            request.Time,
            "HH:mm",
            CultureInfo.InvariantCulture);

        var launch = GetLaunchCommand();

        var psTaskName = QuotePowerShell(TaskName);
        var psExecutable = QuotePowerShell(launch.Executable);
        var psArguments = QuotePowerShell(launch.Arguments);
        var psWorkingDirectory = QuotePowerShell(launch.WorkingDirectory);
        var psTime = QuotePowerShell(time.ToString("HH:mm"));
        var psDay = QuotePowerShell(day.ToString());
        var startWhenAvailable = request.RunIfMissed ? "$true" : "$false";
        var psUser = QuotePowerShell(
            $"{Environment.UserDomainName}\\{Environment.UserName}");

        var script = $$"""
        $ErrorActionPreference = 'Stop'

        $action = New-ScheduledTaskAction `
            -Execute {{psExecutable}} `
            -Argument {{psArguments}} `
            -WorkingDirectory {{psWorkingDirectory}}

        $trigger = New-ScheduledTaskTrigger `
            -Weekly `
            -DaysOfWeek {{psDay}} `
            -At {{psTime}}

        $settings = New-ScheduledTaskSettingsSet `
            -MultipleInstances IgnoreNew `
            -AllowStartIfOnBatteries `
            -DontStopIfGoingOnBatteries `
            -StartWhenAvailable:{{startWhenAvailable}}

        $principal = New-ScheduledTaskPrincipal `
            -UserId {{psUser}} `
            -LogonType Interactive `
            -RunLevel Limited

        $task = New-ScheduledTask `
            -Action $action `
            -Trigger $trigger `
            -Settings $settings `
            -Principal $principal

        Register-ScheduledTask `
            -TaskName {{psTaskName}} `
            -InputObject $task `
            -Force | Out-Null
        """;

        await RunPowerShellOrThrowAsync(
            script,
            "Failed to create PriceWatch scheduled task.");

        await SaveConfigAsync(request);
        return await GetAsync();
    }

    public async Task DeleteAsync()
    {
        EnsureWindows();
        await DeleteTaskAsync();

        if (File.Exists(_paths.ScheduleFile))
        {
            File.Delete(_paths.ScheduleFile);
        }
    }

    private async Task DeleteTaskAsync()
    {
        if (!OperatingSystem.IsWindows())
        {
            return;
        }

        var taskName = QuotePowerShell(TaskName);

        var script = $$"""
        $task = Get-ScheduledTask -TaskName {{taskName}} -ErrorAction SilentlyContinue
        if ($null -ne $task) {
            Unregister-ScheduledTask -TaskName {{taskName}} -Confirm:$false
        }
        """;

        await RunPowerShellOrThrowAsync(
            script,
            "Failed to delete PriceWatch scheduled task.");
    }

    private async Task<bool> TaskExistsAsync()
    {
        if (!OperatingSystem.IsWindows())
        {
            return false;
        }

        var taskName = QuotePowerShell(TaskName);
        var result = await RunPowerShellAsync(
            $"$task = Get-ScheduledTask -TaskName {taskName} -ErrorAction SilentlyContinue; if ($null -eq $task) {{ exit 1 }} else {{ exit 0 }}");

        return result.ExitCode == 0;
    }

    private async Task<ScheduleRequest?> ReadConfigAsync()
    {
        if (!File.Exists(_paths.ScheduleFile))
        {
            return null;
        }

        var json = await File.ReadAllTextAsync(_paths.ScheduleFile);
        return JsonSerializer.Deserialize<ScheduleRequest>(
            json,
            new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
    }

    private async Task SaveConfigAsync(
        ScheduleRequest request)
    {
        var json = JsonSerializer.Serialize(
            request,
            new JsonSerializerOptions
            {
                WriteIndented = true
            });

        var temp = _paths.ScheduleFile + ".tmp";
        await File.WriteAllTextAsync(
            temp,
            json + Environment.NewLine,
            new UTF8Encoding(false));

        File.Move(temp, _paths.ScheduleFile, overwrite: true);
    }

    private static void ValidateRequest(
        ScheduleRequest request)
    {
        if (!Enum.TryParse<DayOfWeek>(
                request.Day,
                ignoreCase: true,
                out _))
        {
            throw new ArgumentException("Invalid day.");
        }

        if (!TimeOnly.TryParseExact(
                request.Time,
                "HH:mm",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out _))
        {
            throw new ArgumentException("Time must use HH:mm format.");
        }
    }

    private LaunchCommand GetLaunchCommand()
    {
        var repoRoot = _settings.RepoRoot?.Trim();
        var nodeExecutable = _settings.NodeExecutable?.Trim();
        var launcherScript = _settings.LauncherScript?.Trim();

        if (string.IsNullOrWhiteSpace(repoRoot) ||
            string.IsNullOrWhiteSpace(nodeExecutable) ||
            string.IsNullOrWhiteSpace(launcherScript))
        {
            throw new InvalidOperationException(
                "Scheduled runs require the repository launcher. Start PriceWatch.Private via npm run dev:private:all or npm run dev:private:api before creating the task.");
        }

        if (!Directory.Exists(repoRoot) || !File.Exists(launcherScript))
        {
            throw new InvalidOperationException(
                "PriceWatch repository launcher could not be found. Recreate the scheduled task from a launcher-started Private instance.");
        }

        if (!File.Exists(nodeExecutable))
        {
            throw new InvalidOperationException(
                "Node.js executable could not be found. Recreate the scheduled task after verifying the local Node.js installation.");
        }

        return new LaunchCommand(
            nodeExecutable,
            $"\"{launcherScript}\" private run-once",
            repoRoot);
    }

    private static async Task RunPowerShellOrThrowAsync(
        string script,
        string fallback)
    {
        var result = await RunPowerShellAsync(script);

        if (result.ExitCode != 0)
        {
            throw new InvalidOperationException(
                string.IsNullOrWhiteSpace(result.Error)
                    ? fallback
                    : result.Error.Trim());
        }
    }

    private static async Task<(int ExitCode, string Output, string Error)>
        RunPowerShellAsync(string script)
    {
        EnsureWindows();

        var startInfo = new ProcessStartInfo
        {
            FileName = "powershell.exe",
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
            CreateNoWindow = true
        };

        startInfo.ArgumentList.Add("-NoProfile");
        startInfo.ArgumentList.Add("-NonInteractive");
        startInfo.ArgumentList.Add("-Command");
        startInfo.ArgumentList.Add(script);

        using var process = Process.Start(startInfo)
                            ?? throw new InvalidOperationException(
                                "Unable to start PowerShell.");

        var stdout = process.StandardOutput.ReadToEndAsync();
        var stderr = process.StandardError.ReadToEndAsync();

        await process.WaitForExitAsync();

        return (
            process.ExitCode,
            await stdout,
            await stderr);
    }

    private static void EnsureWindows()
    {
        if (!OperatingSystem.IsWindows())
        {
            throw new PlatformNotSupportedException(
                "Windows Task Scheduler is only supported on Windows.");
        }
    }

    private static string QuotePowerShell(string value)
    {
        return $"'{value.Replace("'", "''")}'";
    }

    private sealed record LaunchCommand(
        string Executable,
        string Arguments,
        string WorkingDirectory);
}
