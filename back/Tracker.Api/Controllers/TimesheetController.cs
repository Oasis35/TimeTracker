using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Tracker.Api.Data;
using Tracker.Api.Dtos.Tickets;
using Tracker.Api.Dtos.Timesheet;
using Tracker.Api.Infrastructure;
using Tracker.Api.Models;
using Tracker.Api.Options;
using Tracker.Api.Services;

namespace Tracker.Api.Controllers;

[ApiController]
[Route("api/timesheet")]
public sealed class TimesheetController : ControllerBase
{
    private readonly TrackerDbContext _db;
    private readonly TimeTrackingOptions _opts;
    private readonly PublicHolidaysService _holidays;

    public TimesheetController(TrackerDbContext db, IOptions<TimeTrackingOptions> opts, PublicHolidaysService holidays)
    {
        _db = db;
        _opts = opts.Value;
        _holidays = holidays;
    }

    private int MinutesPerDay => _opts.MinutesPerDay;

    [HttpGet]
    public async Task<ActionResult<TimesheetMonthDto>> Get(
        [FromQuery] int year,
        [FromQuery] int month,
        CancellationToken cancellationToken)
    {
        if (month < 1 || month > 12)
            return ApiProblems.BadRequest(this, ApiErrorCodes.MonthInvalid);

        var start = new DateOnly(year, month, 1);
        var end = start.AddMonths(1);

        var days = Enumerable.Range(0, end.DayNumber - start.DayNumber)
            .Select(i => start.AddDays(i))
            .ToList();

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
            .ToListAsync(cancellationToken);

        var rows = entries
            .GroupBy(e => e.TicketId)
            .Select(g =>
            {
                var t = g.First().Ticket;
                var valuesByDate = g
                    .GroupBy(x => x.Date)
                    .ToDictionary(
                        gg => gg.Key,
                        gg => gg.Sum(x => x.QuantityMinutes));

                var completeValues = days.ToDictionary(
                    d => d,
                    d => valuesByDate.TryGetValue(d, out var v) ? v : 0);

                var externalKey = t.ExternalKey ?? "";

                return new TimesheetRowDto
                {
                    TicketId = t.Id,
                    Type = t.Type,
                    ExternalKey = externalKey,
                    Label = t.Label ?? "",
                    Values = completeValues
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
            MinutesPerDay = MinutesPerDay,
            Days = days,
            Rows = rows,
            TotalsByDay = totalsByDay
        });
    }

    [HttpGet("incomplete-days")]
    public async Task<ActionResult<IncompleteDaysDto>> GetIncompleteDays(CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        var from = today.AddDays(-30);

        var holidays = await _holidays.GetAsync(cancellationToken);
        var holidaySet = new HashSet<DateOnly>(
            holidays.Keys.Select(k => DateOnly.ParseExact(k, "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture)));

        var workdays = Enumerable
            .Range(0, today.DayNumber - from.DayNumber)
            .Select(i => from.AddDays(i))
            .Where(d => d.DayOfWeek is not DayOfWeek.Saturday and not DayOfWeek.Sunday)
            .Where(d => !holidaySet.Contains(d))
            .ToList();

        if (workdays.Count == 0)
            return Ok(new IncompleteDaysDto());

        var totalsByDay = await _db.TimeEntries
            .AsNoTracking()
            .Where(e => e.Date >= from && e.Date < today)
            .GroupBy(e => e.Date)
            .Select(g => new { Date = g.Key, Total = g.Sum(x => x.QuantityMinutes) })
            .ToListAsync(cancellationToken);

        var totalsMap = totalsByDay.ToDictionary(x => x.Date, x => x.Total);

        var incomplete = workdays
            .Where(d => (totalsMap.TryGetValue(d, out var total) ? total : 0) < MinutesPerDay)
            .Select(d => d.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture))
            .ToList();

        return Ok(new IncompleteDaysDto { IncompleteDays = incomplete });
    }

    [HttpGet("metadata")]
    public async Task<ActionResult<TimesheetMetadataDto>> GetMetadata(CancellationToken cancellationToken)
    {
        var minutesPerDay = MinutesPerDay;

        if (minutesPerDay <= 0 || minutesPerDay % 4 != 0)
            return ApiProblems.BadRequest(this, ApiErrorCodes.ConfigMinutesPerDayInvalid);

        var allowedDay = new[]
        {
            0,
            minutesPerDay / 4,
            minutesPerDay / 2,
            (minutesPerDay * 3) / 4,
            minutesPerDay
        };

        const int hourStepMinutes = 30;
        var allowedHour = Enumerable
            .Range(0, minutesPerDay / hourStepMinutes + 1)
            .Select(i => i * hourStepMinutes)
            .ToArray();

        var tickets = await _db.Tickets
            .AsNoTracking()
            .OrderBy(t => t.Type)
            .ThenBy(t => t.ExternalKey)
            .Select(t => new TicketDto(t.Id, t.Type, t.ExternalKey, t.Label))
            .ToListAsync(cancellationToken);

        return Ok(new TimesheetMetadataDto
        {
            MinutesPerDay = minutesPerDay,
            AllowedMinutesDayMode = allowedDay,
            AllowedMinutesHourMode = allowedHour,
            DefaultUnit = "day",
            DefaultType = TicketType.DEV,
            Tickets = tickets
        });
    }
}
