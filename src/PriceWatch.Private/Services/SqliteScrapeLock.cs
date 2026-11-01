namespace PriceWatch.Private.Services;

/// <summary>
/// Cross-process lock for one local SQLite scrape worker. The lock file lives
/// next to the database and is held with FileShare.None for the full run.
/// No PostgreSQL session or background lock service is required.
/// </summary>
public sealed class SqliteScrapeLock
{
    private readonly string _lockPath;
    private readonly ILogger<SqliteScrapeLock> _logger;

    public SqliteScrapeLock(IConfiguration configuration, ILogger<SqliteScrapeLock> logger)
    {
        var databasePath = configuration["PriceWatch:SqlitePath"]
            ?? throw new InvalidOperationException("PriceWatch:SqlitePath is required.");
        _lockPath = Path.GetFullPath(databasePath) + ".scrape.lock";
        _logger = logger;
    }

    public Task<SqliteScrapeLockHandle?> TryAcquireAsync(
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        FileStream stream;
        try
        {
            stream = new FileStream(
                _lockPath,
                FileMode.OpenOrCreate,
                FileAccess.ReadWrite,
                FileShare.None);
        }
        catch (IOException)
        {
            // A previous task or the local API is already scraping.
            return Task.FromResult<SqliteScrapeLockHandle?>(null);
        }
        _logger.LogInformation("Acquired local SQLite scrape lock.");
        return Task.FromResult<SqliteScrapeLockHandle?>(
            new SqliteScrapeLockHandle(stream, _logger));
    }
}

public sealed class SqliteScrapeLockHandle : IAsyncDisposable
{
    private FileStream? _stream;
    private readonly ILogger _logger;

    internal SqliteScrapeLockHandle(FileStream stream, ILogger logger)
    {
        _stream = stream;
        _logger = logger;
    }

    public async ValueTask DisposeAsync()
    {
        var stream = Interlocked.Exchange(ref _stream, null);
        if (stream is null) return;
        await stream.DisposeAsync();
        _logger.LogInformation("Released local SQLite scrape lock.");
    }
}
