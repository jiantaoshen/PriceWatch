using Npgsql;

namespace PriceWatch.Private.Services;

/// <summary>
/// Provides a process-independent scrape lock backed by a PostgreSQL
/// session-level advisory lock.
/// </summary>
public sealed class PostgreSqlScrapeLock
{
    // "PW" namespace + resource 1. The two-key advisory-lock form keeps the
    // application namespace explicit and avoids coupling this lock to row data.
    private const int LockNamespace = 0x5057;
    private const int ScrapeLockId = 1;

    private readonly string _connectionString;
    private readonly ILogger<PostgreSqlScrapeLock> _logger;

    public PostgreSqlScrapeLock(
        IConfiguration configuration,
        ILogger<PostgreSqlScrapeLock> logger)
    {
        var connectionString =
            configuration.GetConnectionString("Database")
            ?? throw new InvalidOperationException(
                "Database connection string is missing.");

        // Advisory locks belong to a PostgreSQL session. Disabling pooling is
        // deliberate: disposing the handle closes the physical session, which
        // guarantees PostgreSQL releases the lock even if explicit unlock code
        // never runs.
        var builder = new NpgsqlConnectionStringBuilder(connectionString)
        {
            Pooling = false,
            ApplicationName = "PriceWatch.Private.ScrapeLock"
        };

        _connectionString = builder.ConnectionString;
        _logger = logger;
    }

    public async Task<PostgreSqlScrapeLockHandle?> TryAcquireAsync(
        CancellationToken cancellationToken = default)
    {
        var connection = new NpgsqlConnection(_connectionString);

        try
        {
            await connection.OpenAsync(cancellationToken);

            await using var command = connection.CreateCommand();
            command.CommandText = """
                SELECT pg_try_advisory_lock(@namespace, @resource);
                """;
            command.Parameters.AddWithValue("namespace", LockNamespace);
            command.Parameters.AddWithValue("resource", ScrapeLockId);

            var result = await command.ExecuteScalarAsync(cancellationToken);
            var acquired = result is bool value && value;

            if (!acquired)
            {
                await connection.DisposeAsync();
                return null;
            }

            _logger.LogInformation(
                "Acquired PostgreSQL global scrape lock.");

            return new PostgreSqlScrapeLockHandle(
                connection,
                _logger);
        }
        catch
        {
            await connection.DisposeAsync();
            throw;
        }
    }
}

/// <summary>
/// Owns the dedicated PostgreSQL session that holds the advisory lock.
/// Disposing the handle closes that session and therefore releases the lock.
/// </summary>
public sealed class PostgreSqlScrapeLockHandle : IAsyncDisposable
{
    private NpgsqlConnection? _connection;
    private readonly ILogger _logger;

    internal PostgreSqlScrapeLockHandle(
        NpgsqlConnection connection,
        ILogger logger)
    {
        _connection = connection;
        _logger = logger;
    }

    public async ValueTask DisposeAsync()
    {
        var connection = Interlocked.Exchange(
            ref _connection,
            null);

        if (connection is null)
        {
            return;
        }

        try
        {
            // Pooling is disabled for this connection, so DisposeAsync closes
            // the PostgreSQL session. Session-level advisory locks are released
            // automatically by PostgreSQL when the session ends.
            await connection.DisposeAsync();

            _logger.LogInformation(
                "Released PostgreSQL global scrape lock.");
        }
        catch (Exception exception)
        {
            // Keep the security posture from the exception-sanitization work:
            // do not log exception.Message/ToString(), which could contain
            // connection details from a provider exception.
            _logger.LogWarning(
                "Failed while closing PostgreSQL scrape-lock session. Type={ExceptionType}, StackTrace={StackTrace}",
                exception.GetType().FullName,
                exception.StackTrace);
        }
    }
}
