using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tracker.Api.Data;
using Tracker.Api.Dtos.Tickets;
using Tracker.Api.Models;

namespace Tracker.Api.Controllers;

[ApiController]
[Route("api/tickets")]
public sealed class TicketsController : ControllerBase
{
    private readonly TrackerDbContext _db;

    public TicketsController(TrackerDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TicketDto>>> GetAll()
    {
        var tickets = await _db.Tickets
            .AsNoTracking()
            .OrderBy(t => t.Type)
            .ThenBy(t => t.ExternalKey)
            .Select(t => new TicketDto(t.Id, t.Type, t.ExternalKey, t.Label))
            .ToListAsync();

        return Ok(tickets);
    }

    [HttpPost]
    public async Task<ActionResult<TicketDto>> Create([FromBody] CreateTicketDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Type))
            return BadRequest("Type obligatoire.");

        var type = dto.Type.Trim();
        var externalKey = string.IsNullOrWhiteSpace(dto.ExternalKey) ? null : dto.ExternalKey.Trim();
        var label = string.IsNullOrWhiteSpace(dto.Label) ? null : dto.Label.Trim();

        if (externalKey != null && string.IsNullOrWhiteSpace(label))
            return BadRequest("Label obligatoire si ExternalKey est renseignée.");

        if (externalKey != null)
        {
            var existing = await _db.Tickets
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.Type == type && t.ExternalKey == externalKey);

            if (existing != null)
                return Ok(new TicketDto(existing.Id, existing.Type, existing.ExternalKey, existing.Label));
        }

        var entity = new Ticket
        {
            Type = type,
            ExternalKey = externalKey,
            Label = label
        };

        _db.Tickets.Add(entity);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAll), new { id = entity.Id },
            new TicketDto(entity.Id, entity.Type, entity.ExternalKey, entity.Label));
    }

    [HttpGet("totals")]
    public async Task<ActionResult<List<TicketTotalDto>>> GetTotals([FromQuery] int? year, [FromQuery] int? month)
    {
        DateOnly? start = null;
        DateOnly? end = null;

        if (year.HasValue || month.HasValue)
        {
            if (!year.HasValue || !month.HasValue)
                return BadRequest("Si tu filtres, il faut year ET month.");

            if (month < 1 || month > 12)
                return BadRequest("month invalide.");

            start = new DateOnly(year.Value, month.Value, 1);
            end = start.Value.AddMonths(1);
        }

        var rows = await _db.Tickets
            .AsNoTracking()
            .Select(t => new
            {
                t.Id,
                t.Type,
                ExternalKey = t.ExternalKey ?? "",
                Label = t.Label ?? "",
                TotalMinutes = _db.TimeEntries
                    .Where(e => e.TicketId == t.Id
                                && (!start.HasValue || (e.Date >= start.Value && e.Date < end!.Value)))
                    .Sum(e => (int?)e.QuantityMinutes) ?? 0
            })
            .OrderByDescending(x => x.TotalMinutes)
            .ThenBy(x => x.Type)
            .ThenBy(x => x.ExternalKey)
            .ToListAsync();

        var result = rows
            .Select(x => new TicketTotalDto
            {
                TicketId = x.Id,
                Type = x.Type,
                ExternalKey = x.ExternalKey,
                Label = x.Label,
                Total = x.TotalMinutes
            })
            .ToList();

        return Ok(result);
    }
}
