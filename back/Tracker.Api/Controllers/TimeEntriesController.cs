using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tracker.Api.Data;
using Tracker.Api.Dtos.TimeEntries;
using Tracker.Api.Models;

namespace Tracker.Api.Controllers;

[ApiController]
[Route("api/timeentries")]
public sealed class TimeEntriesController : ControllerBase
{
    private static readonly decimal[] AllowedQuantities =
        { 0m, 0.25m, 0.5m, 0.75m, 1m };

    private readonly TrackerDbContext _db;

    public TimeEntriesController(TrackerDbContext db) => _db = db;

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
                Quantity: g.Sum(x => x.te.Quantity)
            ))
            .OrderBy(x => x.Type)
            .ThenBy(x => x.ExternalKey)
            .ToList();

        var total = grouped.Sum(x => x.Quantity);

        return Ok(new DayViewDto(date, grouped, total));
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
            .ToDictionary(g => g.Key, g => g.Sum(x => x.te.Quantity));

        var rows = entries
            .GroupBy(x => new { x.t.Id, x.t.Type, x.t.ExternalKey, x.t.Label })
            .Select(g =>
            {
                var values = g.GroupBy(x => x.te.Date)
                    .ToDictionary(gg => gg.Key, gg => gg.Sum(x => x.te.Quantity));

                return new WeekRowDto(
                    TicketId: g.Key.Id,
                    Type: g.Key.Type,
                    ExternalKey: g.Key.ExternalKey,
                    Label: g.Key.Label,
                    Values: values,
                    Total: values.Values.Sum()
                );
            })
            .OrderBy(x => x.Type)
            .ThenBy(x => x.ExternalKey)
            .ToList();

        return Ok(new WeekViewDto(monday, days, rows, totalsByDay));
    }

    [HttpPost("upsert")]
    public async Task<IActionResult> Upsert([FromBody] UpsertTimeEntryDto dto)
    {
        if (dto.TicketId <= 0)
            return BadRequest("L'id du ticket est invalide.");

        if (!AllowedQuantities.Contains(dto.Quantity))
            return BadRequest("La quantité saisie est invalide.");

        var ticketExists = await _db.Tickets
            .AsNoTracking()
            .AnyAsync(t => t.Id == dto.TicketId);

        if (!ticketExists)
            return BadRequest("Le ticket n'exixte pas.");

        var existing = await _db.TimeEntries
            .SingleOrDefaultAsync(e =>
                e.TicketId == dto.TicketId &&
                e.Date == dto.Date);

        if (dto.Quantity == 0m)
        {
            if (existing is null)
                return NoContent();

            _db.TimeEntries.Remove(existing);
            await _db.SaveChangesAsync();

            return NoContent();
        }

        var sumOther = await _db.TimeEntries
            .Where(e => e.Date == dto.Date &&
                        e.TicketId != dto.TicketId)
            .SumAsync(e => (decimal?)e.Quantity) ?? 0m;

        var newTotal = sumOther + dto.Quantity;

        if (newTotal > 1m)
            return BadRequest($"Total du jour dépasse 1 ({newTotal}).");

        if (existing is null)
        {
            var entry = new TimeEntry
            {
                TicketId = dto.TicketId,
                Date = dto.Date,
                Quantity = dto.Quantity,
                Comment = dto.Comment
            };

            _db.TimeEntries.Add(entry);
            await _db.SaveChangesAsync();

            return Created("", new { entry.Id });
        }

        existing.Quantity = dto.Quantity;
        existing.Comment = dto.Comment;

        await _db.SaveChangesAsync();

        return NoContent();
    }
}
