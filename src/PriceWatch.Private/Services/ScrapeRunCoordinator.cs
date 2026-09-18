namespace PriceWatch.Private.Services;

public sealed record CoordinatorStatus(
    bool Running,
    Guid? CurrentRunId,
    DateTimeOffset? StartedAt,
    string? LastError);

public sealed class ScrapeRunCoordinator
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ScrapeRunCoordinator> _logger;
    private readonly object _gate = new();

    private Task? _runningTask;
    private Guid? _currentRunId;
    private DateTimeOffset? _startedAt;
    private string? _lastError;

    public ScrapeRunCoordinator(
        IServiceScopeFactory scopeFactory,
        ILogger<ScrapeRunCoordinator> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public CoordinatorStatus GetStatus()
    {
        lock (_gate)
        {
            return new CoordinatorStatus(
                Running: _runningTask is { IsCompleted: false },
                CurrentRunId: _currentRunId,
                StartedAt: _startedAt,
                LastError: _lastError);
        }
    }

    public bool TryStart()
    {
        lock (_gate)
        {
            if (_runningTask is { IsCompleted: false })
            {
                return false;
            }

            _startedAt = DateTimeOffset.UtcNow;
            _currentRunId = null;
            _lastError = null;

            _runningTask = Task.Run(RunAsync);
            return true;
        }
    }

    private async Task RunAsync()
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var orchestrator = scope.ServiceProvider
                .GetRequiredService<ScrapeOrchestrator>();

            var runId = await orchestrator.RunOnceAsync();

            lock (_gate)
            {
                _currentRunId = runId;
            }
        }
        catch (Exception exception)
        {
            _logger.LogError(exception, "Private scrape run failed.");

            lock (_gate)
            {
                _lastError = exception.Message;
            }
        }
    }
}
