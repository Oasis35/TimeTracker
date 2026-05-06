using Microsoft.EntityFrameworkCore;
using Tracker.Api.Data;
using static Tracker.Api.Models.AppSettingKeys;

namespace Tracker.Api.Services;

public sealed class MinutesPerDayResolver(TrackerDbContext db)
{
    public async Task<int> ResolveAsync(CancellationToken cancellationToken = default)
    {
        var value = await db.AppSettings
            .AsNoTracking()
            .Where(s => s.Key == MinutesPerDay)
            .Select(s => s.Value)
            .FirstOrDefaultAsync(cancellationToken);

        if (value is not null && int.TryParse(value, out var minutes) && minutes > 0 && minutes % 4 == 0)
            return minutes;

        return 420;
    }
}
