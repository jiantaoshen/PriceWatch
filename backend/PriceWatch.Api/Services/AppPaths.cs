// ============================================================================
// File: Services/AppPaths.cs
// Purpose:
//   Resolves the PriceWatch project root and centralizes all filesystem paths
//   used by the ASP.NET API, including the independent subscriptions store.
//
// Main functions:
//   - AppPaths(environment): resolves directories/files and creates data folders.
//   - ResolveRootDirectory(...): finds the project root in development/publish.
//
// Inputs:
//   IWebHostEnvironment and the deployed/development directory structure.
//
// Outputs:
//   Absolute paths for python/products.json, data/latest.json, history, runs,
//   settings, data/subscriptions.json and the project .env file.
// ============================================================================

public sealed class AppPaths
{
    public string RootDirectory { get; }
    public string PythonDirectory { get; }
    public string DataDirectory { get; }
    public string HistoryDirectory { get; }
    public string RunsDirectory { get; }
    public string SettingsDirectory { get; }

    public string LatestFile { get; }
    public string ProductsFile { get; }
    public string SubscriptionsFile { get; }
    public string EnvFile { get; }


    public AppPaths(IWebHostEnvironment environment)
    {
        RootDirectory = ResolveRootDirectory(environment);

        PythonDirectory = Path.Combine(RootDirectory, "python");
        DataDirectory = Path.Combine(RootDirectory, "data");
        HistoryDirectory = Path.Combine(DataDirectory, "history");
        RunsDirectory = Path.Combine(DataDirectory, "runs");
        SettingsDirectory = Path.Combine(DataDirectory, "settings");

        LatestFile = Path.Combine(DataDirectory, "latest.json");
        ProductsFile = Path.Combine(PythonDirectory, "products.json");
        SubscriptionsFile = Path.Combine(DataDirectory, "subscriptions.json");
        EnvFile = Path.Combine(RootDirectory, ".env");

        EnsureDirectories();

        Console.WriteLine($"[AppPaths] Root: {RootDirectory}");
        Console.WriteLine($"[AppPaths] Data: {DataDirectory}");
        Console.WriteLine($"[AppPaths] Python: {PythonDirectory}");
    }


    private void EnsureDirectories()
    {
        Directory.CreateDirectory(DataDirectory);
        Directory.CreateDirectory(HistoryDirectory);
        Directory.CreateDirectory(RunsDirectory);
        Directory.CreateDirectory(SettingsDirectory);
    }


    private static string ResolveRootDirectory(IWebHostEnvironment environment)
    {
        var executableDirectory = Path.GetFullPath(AppContext.BaseDirectory);

        if (HasPythonDirectory(executableDirectory))
        {
            return executableDirectory;
        }

        var root = FindProjectRoot(executableDirectory);
        if (root is not null)
        {
            return root;
        }

        var contentRoot = Path.GetFullPath(environment.ContentRootPath);
        root = FindProjectRoot(contentRoot);
        if (root is not null)
        {
            return root;
        }

        throw new InvalidOperationException(
            "Unable to locate the Price Watch root directory. " +
            $"Executable directory: {executableDirectory}. " +
            $"Content root: {contentRoot}."
        );
    }


    private static string? FindProjectRoot(string startDirectory)
    {
        var directory = new DirectoryInfo(startDirectory);

        while (directory is not null)
        {
            if (HasPythonDirectory(directory.FullName))
            {
                return directory.FullName;
            }

            directory = directory.Parent;
        }

        return null;
    }


    private static bool HasPythonDirectory(string directory)
    {
        return Directory.Exists(Path.Combine(directory, "python"));
    }
}
