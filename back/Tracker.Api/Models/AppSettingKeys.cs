namespace Tracker.Api.Models;

public static class AppSettingKeys
{
    public const string Language = "language";
    public const string UnitMode = "unitMode";
    public const string ExternalBaseUrl = "externalBaseUrl";
    public const string MinutesPerDay = "minutesPerDay";

    public static readonly HashSet<string> AllowedKeys =
    [
        Language,
        UnitMode,
        ExternalBaseUrl,
        MinutesPerDay,
    ];
}
