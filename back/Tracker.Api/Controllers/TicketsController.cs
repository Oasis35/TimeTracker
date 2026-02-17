using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tracker.Api.Data;
using Tracker.Api.Dtos;
using Tracker.Api.Models;

namespace Tracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TicketsController : ControllerBase
{
    private readonly TrackerDbContext _db;

    public TicketsController(TrackerDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public Task<List<Ticket>> Get()
    {
        return _db.Tickets
            .AsNoTracking()
            .OrderBy(t => t.Type)
            .ThenBy(t => t.ExternalKey)
            .ToListAsync();
    }

    [HttpPost]
    public async Task<ActionResult<Ticket>> Create([FromBody] Ticket ticket)
    {
        var validationError = ValidateTicket(ticket);
        if (validationError != null)
            return BadRequest(validationError);

        _db.Tickets.Add(ticket);
        await _db.SaveChangesAsync();

        return Created("", ticket);
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

        var result = await _db.Tickets
            .AsNoTracking()
            .Select(t => new TicketTotalDto
            {
                TicketId = t.Id,
                Type = t.Type,
                ExternalKey = t.ExternalKey ?? "",
                Label = t.Label ?? "",
                Total = _db.TimeEntries
                    .Where(e => e.TicketId == t.Id
                                && (!start.HasValue || (e.Date >= start.Value && e.Date < end!.Value)))
                    .Sum(e => (decimal?)e.Quantity) ?? 0m
            })
            .OrderByDescending(x => x.Total)
            .ThenBy(x => x.Type)
            .ThenBy(x => x.ExternalKey)
            .ToListAsync();

        return Ok(result);
    }

    private static string? ValidateTicket(Ticket ticket)
    {
        if (string.IsNullOrWhiteSpace(ticket.Type))
            return "Le type est obligatoire";

        if (!string.IsNullOrWhiteSpace(ticket.ExternalKey)
            && string.IsNullOrWhiteSpace(ticket.Label))
            return "Le label est obligatoire";

        return null;
    }
}