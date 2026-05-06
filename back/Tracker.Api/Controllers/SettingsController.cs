using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tracker.Api.Data;
using Tracker.Api.Dtos.Settings;
using Tracker.Api.Infrastructure;
using Tracker.Api.Models;
using static Tracker.Api.Models.AppSettingKeys;

namespace Tracker.Api.Controllers;

[ApiController]
[Route("api/settings")]
public sealed class SettingsController : ControllerBase
{
    private readonly TrackerDbContext _db;

    public SettingsController(TrackerDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<Dictionary<string, string>>> GetAll(CancellationToken cancellationToken)
    {
        var settings = await _db.AppSettings
            .AsNoTracking()
            .ToDictionaryAsync(s => s.Key, s => s.Value, cancellationToken);
        return Ok(settings);
    }

    [HttpPut("{key}")]
    public async Task<IActionResult> Upsert(string key, [FromBody] UpsertSettingDto dto, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(key) || key.Length > 64)
            return ApiProblems.BadRequest(this, ApiErrorCodes.SettingKeyInvalid);

        if (!AllowedKeys.Contains(key))
            return ApiProblems.BadRequest(this, ApiErrorCodes.SettingKeyNotAllowed);

        if (dto.Value is null)
            return ApiProblems.BadRequest(this, ApiErrorCodes.SettingValueRequired);

        if (key == MinutesPerDay)
        {
            if (!int.TryParse(dto.Value, out var minutes) || minutes <= 0 || minutes % 4 != 0)
                return ApiProblems.BadRequest(this, ApiErrorCodes.MinutesPerDayInvalid);
        }

        var rows = await _db.AppSettings
            .Where(s => s.Key == key)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Value, dto.Value), cancellationToken);

        if (rows == 0)
            _db.AppSettings.Add(new AppSetting { Key = key, Value = dto.Value });

        await _db.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    [HttpDelete("{key}")]
    public async Task<IActionResult> Delete(string key, CancellationToken cancellationToken)
    {
        if (!AllowedKeys.Contains(key))
            return ApiProblems.BadRequest(this, ApiErrorCodes.SettingKeyNotAllowed);

        var existing = await _db.AppSettings.FindAsync([key], cancellationToken);
        if (existing is not null)
        {
            _db.AppSettings.Remove(existing);
            await _db.SaveChangesAsync(cancellationToken);
        }
        return NoContent();
    }
}
