namespace PriceWatch.Private.Models;

public sealed class ScheduleRequest
{
    public bool Enabled { get; init; } = true;

    public string Day { get; init; } = "Monday";

    public string Time { get; init; } = "08:00";

    public bool RunIfMissed { get; init; } = true;
}

public sealed record ScheduleStatus(
    bool TaskExists,
    bool Enabled,
    string Day,
    string Time,
    bool RunIfMissed
);
