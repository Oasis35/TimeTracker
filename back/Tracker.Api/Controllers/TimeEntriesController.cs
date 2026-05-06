using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tracker.Api.Data;
using Tracker.Api.Dtos.TimeEntries;
using Tracker.Api.Infrastructure;
using Tracker.Api.Models;
using Tracker.Api.Services;

namespace Tracker.Api.Controllers;

[ApiController]
[Route("api/timeentries")]
public sealed class TimeEntriesController : ControllerBase
{
    private readonly TrackerDbContext _db;
    private readonly MinutesPerDayResolver _minutesResolver;

    public TimeEntriesController(TrackerDbContext db, MinutesPerDayResolver minutesResolver)
    {
        _db = db;
        _minutesResolver = minutesResolver;
    }

    [HttpGet("days-exceeding")]
    public async Task<ActionResult<DaysExceedingDto>> GetDaysExceeding([FromQuery] int minutes, CancellationToken cancellationToken)
    {
        if (minutes <= 0)
            return ApiProblems.BadRequest(this, ApiErrorCodes.MinutesOutOfRange);

        var count = await _db.TimeEntries.AsNoTracking()
            .GroupBy(e => e.Date)
            .CountAsync(g => g.Sum(e => e.QuantityMinutes) > minutes, cancellationToken);

        return Ok(new DaysExceedingDto { Count = count });
    }

    [HttpPost("upsert")]
    public async Task<IActionResult> Upsert([FromBody] UpsertTimeEntryDto dto, CancellationToken cancellationToken)
    {
        if (dto.TicketId <= 0)
            return ApiProblems.BadRequest(this, ApiErrorCodes.TicketIdInvalid);

        var ticketExists = await _db.Tickets
            .AsNoTracking()
            .AnyAsync(t => t.Id == dto.TicketId, cancellationToken);

        if (!ticketExists)
            return ApiProblems.NotFound(this, ApiErrorCodes.TicketNotFound);

        var existing = await _db.TimeEntries
            .SingleOrDefaultAsync(e => e.TicketId == dto.TicketId && e.Date == dto.Date, cancellationToken);

        var dayTotal = await _db.TimeEntries
            .Where(e => e.Date == dto.Date)
            .SumAsync(e => (int?)e.QuantityMinutes, cancellationToken) ?? 0;

        var minutesPerDay = await _minutesResolver.ResolveAsync(cancellationToken);
        var existingMinutes = existing?.QuantityMinutes ?? 0;
        var ruleError = TimeEntryRules.Validate(
            ticketId: dto.TicketId,
            quantityMinutes: dto.QuantityMinutes,
            minutesPerDay: minutesPerDay,
            dayTotalMinutes: dayTotal,
            existingMinutes: existingMinutes);

        if (ruleError is not null)
            return ApiProblems.BadRequest(this, ruleError.Code);

        if (dto.QuantityMinutes == 0)
        {
            if (existing is null)
                return NoContent();

            _db.TimeEntries.Remove(existing);
            await _db.SaveChangesAsync(cancellationToken);
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
            await _db.SaveChangesAsync(cancellationToken);

            return Created("", new { entry.Id });
        }

        existing.QuantityMinutes = dto.QuantityMinutes;
        await _db.SaveChangesAsync(cancellationToken);

        return NoContent();
    }
}
