using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tracker.Api.Data;
using Tracker.Api.Dtos;

namespace Tracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TimesheetController : ControllerBase
{
    private readonly TrackerDbContext _db;

    public TimesheetController(TrackerDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<TimesheetMonthDto>> Get(
        [FromQuery] int year,
        [FromQuery] int month)
    {
        if (month < 1 || month > 12)
            return BadRequest("Le mois est invalide");

        var start = new DateOnly(year, month, 1);
        var end = start.AddMonths(1);

        var days = Enumerable.Range(0, end.DayNumber - start.DayNumber)
            .Select(i => start.AddDays(i))
            .ToList();

        var entries = await _db.TimeEntries
            .AsNoTracking()
            .Where(e => e.Date >= start && e.Date < end)
            .Select(e => new
            {
                e.TicketId,
                e.Date,
                e.Quantity,
                Ticket = new
                {
                    e.Ticket!.Id,
                    e.Ticket.Type,
                    e.Ticket.ExternalKey,
                    e.Ticket.Label
                }
            })
            .ToListAsync();

        var rows = entries
            .GroupBy(e => e.TicketId)
            .Select(g =>
            {
                var t = g.First().Ticket;

                var values = g
                    .GroupBy(x => x.Date)
                    .ToDictionary(
                        gg => gg.Key,
                        gg => gg.Sum(x => x.Quantity));

                return new TimesheetRowDto
                {
                    TicketId = t.Id,
                    Type = t.Type,
                    ExternalKey = t.ExternalKey ?? "",
                    Label = t.Label ?? "",
                    Values = values,
                    Total = values.Values.Sum()
                };
            })
            .OrderBy(r => r.Type)
            .ThenBy(r => r.ExternalKey)
            .ToList();

        var totalsByDay = entries
            .GroupBy(e => e.Date)
            .ToDictionary(
                g => g.Key,
                g => g.Sum(x => x.Quantity));

        return Ok(new TimesheetMonthDto
        {
            Year = year,
            Month = month,
            Days = days,
            Rows = rows,
            TotalsByDay = totalsByDay
        });
    }

    [HttpGet("metadata")]
    public async Task<IActionResult> GetMetadata()
    {
        var tickets = await _db.Tickets
            .AsNoTracking()
            .OrderBy(t => t.Type)
            .ThenBy(t => t.ExternalKey)
            .ToListAsync();

        return Ok(new
        {
            allowedQuantities = new[] { 0m, 0.25m, 0.5m, 0.75m, 1m },
            tickets = tickets
        });
    }

}
