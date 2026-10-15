namespace PriceWatch.Private;

public sealed class PrivateSettings
{
    public string ListenUrl { get; set; } = "http://127.0.0.1:5188";

    public string ApiToken { get; set; } = string.Empty;

    public string PythonExecutable { get; set; } = "python";

    public string PythonScript { get; set; } = "scraper/worker.py";

    public bool Headless { get; set; } = true;

    public decimal SuspiciousChangeRatio { get; set; } = 0.80m;
}
