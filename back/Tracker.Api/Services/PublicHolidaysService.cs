using System.Text.Json;

namespace Tracker.Api.Services;

public sealed class PublicHolidaysService(IHttpClientFactory httpClientFactory, ILogger<PublicHolidaysService> logger)
{
    private const string ApiUrl = "https://calendrier.api.gouv.fr/jours-feries/metropole.json";
    private static readonly TimeSpan Ttl = TimeSpan.FromHours(24);

    private Dictionary<string, string>? _cache;
    private DateTime _cachedAt = DateTime.MinValue;

    public async Task<Dictionary<string, string>> GetAsync(CancellationToken ct = default)
    {
        if (_cache is not null && DateTime.UtcNow - _cachedAt < Ttl)
            return _cache;

        try
        {
            var client = httpClientFactory.CreateClient("gouv");
            var json = await client.GetStringAsync(ApiUrl, ct);
            var result = JsonSerializer.Deserialize<Dictionary<string, string>>(json) ?? [];
            _cache = result;
            _cachedAt = DateTime.UtcNow;
            return result;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to fetch public holidays from {Url}", ApiUrl);
            return _cache ?? [];
        }
    }
}
