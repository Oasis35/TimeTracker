using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Tracker.Api.Data;
using Tracker.Api.Dtos;
using Tracker.Api.Dtos.Timesheet;
using Tracker.Api.Options;

namespace Tracker.Api.Controllers;

[ApiController]
[Route("api/timesheet")]
public sealed class TimesheetController : ControllerBase
{
    private readonly TrackerDbContext _db;
    private readonly TimeTrackingOptions _opts;

    public TimesheetController(TrackerDbContext db, IOptions<TimeTrackingOptions> opts)
    {
        _db = db;
        _opts = opts.Value;
    }

    private int MinutesPerDay => _opts.HoursPerDay * 60;

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

        // Si tu gardes TicketId nullable, sécurise la requête
        var entries = await _db.TimeEntries
            .AsNoTracking()
            .Where(e => e.Date >= start && e.Date < end && e.TicketId != null)
            .Select(e => new
            {
                e.TicketId,
                e.Date,
                e.QuantityMinutes,
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
                        gg => gg.Sum(x => x.QuantityMinutes));

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
                g => g.Sum(x => x.QuantityMinutes));

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
    public async Task<ActionResult<TimesheetMetadataDto>> GetMetadata()
    {
        if (_opts.HoursPerDay <= 0)
            return Problem("Configuration invalide: HoursPerDay doit être > 0.");

        var minutesPerDay = MinutesPerDay;

        // Boutons "jour" : 0, 1/4, 1/2, 3/4, 1 jour
        if (minutesPerDay % 4 != 0)
            return Problem("Configuration invalide: HoursPerDay doit donner un nombre de minutes divisible par 4 pour le mode 'quart de journée'.");

        var allowedDay = new[]
        {
            0,
            minutesPerDay / 4,
            minutesPerDay / 2,
            (minutesPerDay * 3) / 4,
            minutesPerDay
        };

        // Boutons "heure" : exemple pas de 30 minutes (ajuste si tu veux 15)
        const int hourStepMinutes = 30;
        var allowedHour = Enumerable
            .Range(0, minutesPerDay / hourStepMinutes + 1)
            .Select(i => i * hourStepMinutes)
            .ToArray();

        var tickets = await _db.Tickets
            .AsNoTracking()
            .OrderBy(t => t.Type)
            .ThenBy(t => t.ExternalKey)
            .Select(t => new Tracker.Api.Dtos.Tickets.TicketDto(t.Id, t.Type, t.ExternalKey, t.Label))
            .ToListAsync();

        return Ok(new TimesheetMetadataDto(
            HoursPerDay: _opts.HoursPerDay,
            MinutesPerDay: minutesPerDay,
            AllowedMinutesDayMode: allowedDay,
            AllowedMinutesHourMode: allowedHour,
            DefaultUnit: "day",
            DefaultType: "DEV",
            Tickets: tickets
        ));
    }
}