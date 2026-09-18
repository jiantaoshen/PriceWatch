namespace PriceWatch.Private.Services;

public sealed class PrivatePaths
{
    public PrivatePaths()
    {
        var localAppData = Environment.GetFolderPath(
            Environment.SpecialFolder.LocalApplicationData);

        RootDirectory = Path.Combine(
            localAppData,
            "PriceWatch",
            "Private");

        SettingsDirectory = Path.Combine(
            RootDirectory,
            "settings");

        DebugDirectory = Path.Combine(
            RootDirectory,
            "debug");

        Directory.CreateDirectory(SettingsDirectory);
        Directory.CreateDirectory(DebugDirectory);
    }

    public string RootDirectory { get; }

    public string SettingsDirectory { get; }

    public string DebugDirectory { get; }

    public string ScheduleFile => Path.Combine(
        SettingsDirectory,
        "schedule.json");
}
