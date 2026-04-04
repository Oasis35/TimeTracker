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

    private int MinutesPerDay => _opts.MinutesPerDay;

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

        if (existing is null)
        {
            var entry = new TimeEntry
            {
                TicketId = dto.TicketId,
                Date = dto.Date,
                QuantityMinutes = dto.QuantityMinutes,
            };

            _db.TimeEntries.Add(entry);
            await _db.SaveChangesAsync();

            return Created("", new { entry.Id });
        }

        existing.QuantityMinutes = dto.QuantityMinutes;
        await _db.SaveChangesAsync();

        return NoContent();
    }
}
