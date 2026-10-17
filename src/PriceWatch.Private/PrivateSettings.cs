namespace PriceWatch.Private;

public sealed class PrivateSettings
{
    public string ListenUrl { get; set; } = "http://127.0.0.1:5188";

    public string ApiToken { get; set; } = string.Empty;

    public string PythonExecutable { get; set; } = "python";

    public string PythonScript { get; set; } = "scraper/worker.py";

    public bool Headless { get; set; } = true;

    public decimal SuspiciousChangeRatio { get; set; } = 0.80m;

    // Injected by the repository launcher. Windows Task Scheduler uses these
    // values to invoke the same launcher and reload .env.local for every run.
    public string RepoRoot { get; set; } = string.Empty;

    public string NodeExecutable { get; set; } = string.Empty;

    public string LauncherScript { get; set; } = string.Empty;
}
