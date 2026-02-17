using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tracker.Api.Data;
using Tracker.Api.Dtos;
using Tracker.Api.Models;

namespace Tracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TimeEntriesController : ControllerBase
{
    private static readonly decimal[] AllowedQuantities =
        { 0m, 0.25m, 0.5m, 0.75m, 1m };

    private readonly TrackerDbContext _db;

    public TimeEntriesController(TrackerDbContext db)
    {
        _db = db;
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
