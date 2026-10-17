namespace PriceWatch.Data.Entities;

public enum ItemType
{
    Product,
    Subscription
}

public enum PriceOrigin
{
    Scrape,
    Manual
}

public enum BestPriceChangeCause
{
    Automatic,
    Manual,
    Review,
    SourceChange
}

public enum ScrapeRunStatus
{
    Running,
    Success,
    Partial,
    Failed,
    Abandoned
}

public enum ScrapeResultStatus
{
    Success,
    Suspicious,
    Failed
}

public enum ReviewStatus
{
    NotRequired,
    Pending,
    Accepted,
    Rejected,
    ManualOverride
}

public enum AlertStatus
{
    Pending,
    Sent,
    Failed
}
