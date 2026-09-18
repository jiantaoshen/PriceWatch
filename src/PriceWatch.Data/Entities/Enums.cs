namespace PriceWatch.Data.Entities;

public enum ItemType
{
    Product,
    Subscription
}

public enum UpdateMode
{
    Manual,
    Automatic,
    Hybrid
}

public enum PriceOrigin
{
    Scrape,
    Manual,
    ManualOverride
}

public enum ScrapeRunStatus
{
    Running,
    Success,
    Partial,
    Failed
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