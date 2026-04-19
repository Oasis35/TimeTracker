using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tracker.Api.Data;
using Tracker.Api.Dtos.Settings;
using Tracker.Api.Infrastructure;
using Tracker.Api.Models;

namespace Tracker.Api.Controllers;

[ApiController]
[Route("api/settings")]
public sealed class SettingsController : ControllerBase
{
    private readonly TrackerDbContext _db;

    public SettingsController(TrackerDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<Dictionary<string, string>>> GetAll()
    {
        var settings = await _db.AppSettings
            .AsNoTracking()
            .ToDictionaryAsync(s => s.Key, s => s.Value);
        return Ok(settings);
    }

    [HttpPut("{key}")]
    public async Task<IActionResult> Upsert(string key, [FromBody] UpsertSettingDto dto)
    {
        if (string.IsNullOrWhiteSpace(key) || key.Length > 64)
            return ApiProblems.BadRequest(this, ApiErrorCodes.SettingKeyInvalid);

        if (dto.Value is null)
            return ApiProblems.BadRequest(this, ApiErrorCodes.SettingValueRequired);

        var updated = await _db.AppSettings
            .Where(s => s.Key == key)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Value, dto.Value));

        if (updated == 0)
            _db.AppSettings.Add(new AppSetting { Key = key, Value = dto.Value });

        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("{key}")]
    public async Task<IActionResult> Delete(string key)
    {
        var existing = await _db.AppSettings.FindAsync(key);
        if (existing is not null)
        {
            _db.AppSettings.Remove(existing);
            await _db.SaveChangesAsync();
        }
        return NoContent();
    }
}
