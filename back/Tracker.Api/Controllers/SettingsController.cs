using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tracker.Api.Data;
using Tracker.Api.Dtos.Settings;
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
            return BadRequest("Invalid key.");

        if (dto.Value is null)
            return BadRequest("Value is required.");

        await _db.Database.ExecuteSqlAsync(
            $"INSERT INTO AppSettings (Key, Value) VALUES ({key}, {dto.Value}) ON CONFLICT(Key) DO UPDATE SET Value = excluded.Value");

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
