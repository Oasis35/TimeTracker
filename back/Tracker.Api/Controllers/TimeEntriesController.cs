using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Tracker.Api.Data;
using Tracker.Api.Dtos.TimeEntries;
using Tracker.Api.Infrastructure;
using Tracker.Api.Models;
using Tracker.Api.Options;
using Tracker.Api.Services;

namespace Tracker.Api.Controllers;

[ApiController]
[Route("api/timeentries")]
public sealed class TimeEntriesController : ControllerBase
{
    private readonly TrackerDbContext _db;
    private readonly TimeTrackingOptions _opts;

    public TimeEntriesController(TrackerDbContext db, IOptions<TimeTrackingOptions> opts)
    {
        _db = db;
        _opts = opts.Value;
    }

    private int MinutesPerDay => _opts.HoursPerDay * 60;

    [HttpGet("day")]
    public async Task<ActionResult<DayViewDto>> GetDay([FromQuery] DateOnly date)
    {
        var entries = await _db.TimeEntries
            .AsNoTracking()
            .Where(e => e.Date == date && e.TicketId != null)
            .Join(_db.Tickets.AsNoTracking(),
                te => te.TicketId!,
                t => t.Id,
                (te, t) => new { te, t })
            .ToListAsync();

        var grouped = entries
            .GroupBy(x => new { x.t.Id, x.t.Type, x.t.ExternalKey, x.t.Label })
            .Select(g => new DayEntryDto(
                TicketId: g.Key.Id,
                Type: g.Key.Type,
                ExternalKey: g.Key.ExternalKey,
                Label: g.Key.Label,
                QuantityMinutes: g.Sum(x => x.te.QuantityMinutes)
            ))
            .OrderBy(x => x.Type)
            .ThenBy(x => x.ExternalKey)
            .ToList();

        var totalMinutes = grouped.Sum(x => x.QuantityMinutes);

        return Ok(new DayViewDto(date, grouped, totalMinutes, MinutesPerDay));
    }

    [HttpGet("week")]
    public async Task<ActionResult<WeekViewDto>> GetWeek([FromQuery] DateOnly start)
    {
        var monday = start.AddDays(-(((int)start.DayOfWeek + 6) % 7));
        var days = Enumerable.Range(0, 7).Select(i => monday.AddDays(i)).ToList();
        var endExclusive = monday.AddDays(7);

        var entries = await _db.TimeEntries
            .AsNoTracking()
            .Where(e => e.Date >= monday && e.Date < endExclusive && e.TicketId != null)
            .Join(_db.Tickets.AsNoTracking(),
                te => te.TicketId!,
                t => t.Id,
                (te, t) => new { te, t })
            .ToListAsync();

        var totalsByDay = entries
            .GroupBy(x => x.te.Date)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.te.QuantityMinutes));

        var rows = entries
            .GroupBy(x => new { x.t.Id, x.t.Type, x.t.ExternalKey, x.t.Label })
            .Select(g =>
            {
                var values = g.GroupBy(x => x.te.Date)
                    .ToDictionary(gg => gg.Key, gg => gg.Sum(x => x.te.QuantityMinutes));

                return new WeekRowDto(
                    TicketId: g.Key.Id,
                    Type: g.Key.Type,
                    ExternalKey: g.Key.ExternalKey,
                    Label: g.Key.Label,
                    ValuesMinutes: values,
                    TotalMinutes: values.Values.Sum()
                );
            })
            .OrderBy(x => x.Type)
            .ThenBy(x => x.ExternalKey)
            .ToList();

        return Ok(new WeekViewDto(monday, days, rows, totalsByDay, MinutesPerDay));
    }

    [HttpPost("upsert")]
    public async Task<IActionResult> Upsert([FromBody] UpsertTimeEntryDto dto)
    {
        if (dto.TicketId <= 0)
            return ApiProblems.BadRequest(this, ApiErrorCodes.TicketIdInvalid);

        var ticket = await _db.Tickets
            .AsNoTracking()
            .Where(t => t.Id == dto.TicketId)
            .Select(t => new
            {
                t.Id,
                t.IsCompleted
            })
            .FirstOrDefaultAsync();

        if (ticket is null)
            return ApiProblems.BadRequest(this, ApiErrorCodes.TicketNotFound);
        if (ticket.IsCompleted)
            return ApiProblems.BadRequest(this, ApiErrorCodes.TicketCompletedLocked);

        var existing = await _db.TimeEntries
            .SingleOrDefaultAsync(e => e.TicketId == dto.TicketId && e.Date == dto.Date);

        var dayTotal = await _db.TimeEntries
            .Where(e => e.Date == dto.Date)
            .SumAsync(e => (int?)e.QuantityMinutes) ?? 0;

        var existingMinutes = existing?.QuantityMinutes ?? 0;
        var ruleError = TimeEntryRules.Validate(
            ticketId: dto.TicketId,
            quantityMinutes: dto.QuantityMinutes,
            minutesPerDay: MinutesPerDay,
            dayTotalMinutes: dayTotal,
            existingMinutes: existingMinutes);

        if (ruleError is not null)
            return ApiProblems.BadRequest(this, ruleError.Code);

        if (dto.QuantityMinutes == 0)
        {
            if (existing is null)
                return NoContent();

            _db.TimeEntries.Remove(existing);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        var comment = string.IsNullOrWhiteSpace(dto.Comment) ? null : dto.Comment.Trim();

        if (existing is null)
        {
            var entry = new TimeEntry
            {
                TicketId = dto.TicketId,
                Date = dto.Date,
                QuantityMinutes = dto.QuantityMinutes,
                Comment = comment
            };

            _db.TimeEntries.Add(entry);
            await _db.SaveChangesAsync();

            return Created("", new { entry.Id });
        }

        existing.QuantityMinutes = dto.QuantityMinutes;
        existing.Comment = comment;
        await _db.SaveChangesAsync();

        return NoContent();
    }
}
