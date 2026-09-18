using System.Diagnostics;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using PriceWatch.Private.Models;

namespace PriceWatch.Private.Services;

public sealed class PythonScraperClient
{
    private readonly PrivateSettings _settings;
    private readonly IHostEnvironment _environment;
    private readonly ILogger<PythonScraperClient> _logger;

    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    public PythonScraperClient(
        IOptions<PrivateSettings> options,
        IHostEnvironment environment,
        ILogger<PythonScraperClient> logger)
    {
        _settings = options.Value;
        _environment = environment;
        _logger = logger;
    }

    public async Task<IReadOnlyList<ScrapeWorkerResult>> ScrapeAsync(
        IReadOnlyCollection<ScrapeJob> jobs,
        CancellationToken cancellationToken = default)
    {
        if (jobs.Count == 0)
        {
            return [];
        }

        var scriptPath = ResolveScriptPath();

        if (!File.Exists(scriptPath))
        {
            throw new FileNotFoundException(
                "Python scraper worker was not found.",
                scriptPath);
        }

        var request = new ScrapeBatchRequest
        {
            Headless = _settings.Headless,
            Jobs = jobs.ToList()
        };

        var payload = JsonSerializer.Serialize(
            request,
            _jsonOptions);

        var startInfo = new ProcessStartInfo
        {
            FileName = _settings.PythonExecutable,
            WorkingDirectory = Path.GetDirectoryName(scriptPath)!,
            UseShellExecute = false,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardInputEncoding =
                new UTF8Encoding(
                    encoderShouldEmitUTF8Identifier: false),

            StandardOutputEncoding =
                new UTF8Encoding(
                    encoderShouldEmitUTF8Identifier: false),

            StandardErrorEncoding =
                new UTF8Encoding(
                    encoderShouldEmitUTF8Identifier: false),
            CreateNoWindow = true
        };

        startInfo.ArgumentList.Add("-u");
        startInfo.ArgumentList.Add(scriptPath);
        startInfo.Environment["PYTHONUTF8"] = "1";
        startInfo.Environment["PYTHONIOENCODING"] = "utf-8";

        using var process = new Process
        {
            StartInfo = startInfo
        };

        if (!process.Start())
        {
            throw new InvalidOperationException(
                "Unable to start the Python scraper worker.");
        }

        await process.StandardInput.WriteAsync(payload);
        await process.StandardInput.FlushAsync();
        process.StandardInput.Close();

        var stdoutTask = process.StandardOutput.ReadToEndAsync(cancellationToken);
        var stderrTask = process.StandardError.ReadToEndAsync(cancellationToken);

        await process.WaitForExitAsync(cancellationToken);

        var stdout = await stdoutTask;
        var stderr = await stderrTask;

        if (!string.IsNullOrWhiteSpace(stderr))
        {
            foreach (var line in stderr.Split(
                         Environment.NewLine,
                         StringSplitOptions.RemoveEmptyEntries))
            {
                _logger.LogInformation("[PYTHON] {Line}", line);
            }
        }

        if (process.ExitCode != 0)
        {
            throw new InvalidOperationException(
                $"Python scraper exited with code {process.ExitCode}. {stderr}".Trim());
        }

        var response = JsonSerializer.Deserialize<ScrapeBatchResponse>(
            stdout,
            _jsonOptions);

        if (response is null)
        {
            throw new InvalidOperationException(
                "Python scraper returned an empty or invalid response.");
        }

        return response.Results;
    }

    private string ResolveScriptPath()
    {
        if (Path.IsPathRooted(_settings.PythonScript))
        {
            return Path.GetFullPath(_settings.PythonScript);
        }

        var candidates = new[]
        {
            Path.GetFullPath(
                Path.Combine(
                    _environment.ContentRootPath,
                    _settings.PythonScript)),

            Path.GetFullPath(
                Path.Combine(
                    AppContext.BaseDirectory,
                    _settings.PythonScript)),

            Path.GetFullPath(
                Path.Combine(
                    _environment.ContentRootPath,
                    "..",
                    "..",
                    "scraper",
                    "worker.py")),

            Path.GetFullPath(
                Path.Combine(
                    AppContext.BaseDirectory,
                    "scraper",
                    "worker.py"))
        };

        return candidates.FirstOrDefault(File.Exists)
               ?? candidates[0];
    }
}
