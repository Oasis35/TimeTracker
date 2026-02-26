using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Tracker.Api.Data;
using Tracker.Api.Dtos;
using Tracker.Api.Dtos.Timesheet;
using Tracker.Api.Infrastructure;
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
            .ToListAsync();

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
                var ticketKey = string.IsNullOrWhiteSpace(externalKey)
                    ? t.Type
                    : $"{t.Type}-{externalKey}";

                return new TimesheetRowDto
                {
                    TicketId = t.Id,
                    Type = t.Type,
                    ExternalKey = externalKey,
                    Label = t.Label ?? "",
                    TicketKey = ticketKey,
                    Values = completeValues,
                    Total = completeValues.Values.Sum()
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

    [HttpGet("metadata")]
    public async Task<ActionResult<TimesheetMetadataDto>> GetMetadata()
    {
        if (_opts.HoursPerDay <= 0)
            return ApiProblems.BadRequest(this, ApiErrorCodes.ConfigHoursPerDayInvalid);

        var minutesPerDay = MinutesPerDay;

        if (minutesPerDay % 4 != 0)
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

        return Ok(new TimesheetMetadataDto(
            HoursPerDay: _opts.HoursPerDay,
            MinutesPerDay: minutesPerDay,
            AllowedMinutesDayMode: allowedDay,
            AllowedMinutesHourMode: allowedHour,
            DefaultUnit: "day",
            DefaultType: "DEV"
        ));
    }
}
