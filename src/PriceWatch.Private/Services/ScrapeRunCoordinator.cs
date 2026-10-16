using PriceWatch.Private.Models;

namespace PriceWatch.Private.Services;

public sealed record CoordinatorStatus(
    bool Running,
    Guid? CurrentRunId,
    DateTimeOffset? StartedAt,
    string? LastError);

public enum ScrapeStartResult
{
    Started,
    AlreadyRunning
}

public sealed class ScrapeRunCoordinator
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly PostgreSqlScrapeLock _globalLock;
    private readonly ILogger<ScrapeRunCoordinator> _logger;
    private readonly object _gate = new();
    private readonly SemaphoreSlim _startGate = new(1, 1);

    private Task? _runningTask;
    private Guid? _currentRunId;
    private DateTimeOffset? _startedAt;
    private string? _lastError;

    public ScrapeRunCoordinator(
        IServiceScopeFactory scopeFactory,
        PostgreSqlScrapeLock globalLock,
        ILogger<ScrapeRunCoordinator> logger)
    {
        _scopeFactory = scopeFactory;
        _globalLock = globalLock;
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

    public async Task<ScrapeStartResult> TryStartAsync(
        CancellationToken cancellationToken = default)
    {
        await _startGate.WaitAsync(cancellationToken);

        try
        {
            lock (_gate)
            {
                if (_runningTask is { IsCompleted: false })
                {
                    return ScrapeStartResult.AlreadyRunning;
                }
            }

            // Acquire the database-backed lock before acknowledging the API
            // request. This catches runs started by Task Scheduler, another
            // process, or a future second worker as well as this process.
            var globalLock = await _globalLock.TryAcquireAsync(
                cancellationToken);

            if (globalLock is null)
            {
                return ScrapeStartResult.AlreadyRunning;
            }

            lock (_gate)
            {
                _startedAt = DateTimeOffset.UtcNow;
                _currentRunId = null;
                _lastError = null;

                _runningTask = Task.Run(() => RunAsync(globalLock));
            }

            return ScrapeStartResult.Started;
        }
        finally
        {
            _startGate.Release();
        }
    }

    private async Task RunAsync(
        PostgreSqlScrapeLockHandle globalLock)
    {
        await using (globalLock)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var orchestrator = scope.ServiceProvider
                    .GetRequiredService<ScrapeOrchestrator>();

                var runId = await orchestrator.RunOnceAsync(ScrapeTrigger.OnDemand);

                lock (_gate)
                {
                    _currentRunId = runId;
                }
            }
            catch (Exception exception)
            {
                var errorId = Guid.NewGuid();

                _logger.LogError(
                    "Private scrape run failed. ErrorId={ErrorId}, Type={ExceptionType}, StackTrace={StackTrace}",
                    errorId,
                    exception.GetType().FullName,
                    exception.StackTrace);

                lock (_gate)
                {
                    _lastError =
                        $"Scrape run failed. Error ID: {errorId}";
                }
            }
        }
    }
}
