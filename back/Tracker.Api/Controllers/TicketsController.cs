using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tracker.Api.Data;
using Tracker.Api.Dtos.Tickets;
using Tracker.Api.Infrastructure;
using Tracker.Api.Models;

namespace Tracker.Api.Controllers;

[ApiController]
[Route("api/tickets")]
public sealed class TicketsController : ControllerBase
{
    private readonly TrackerDbContext _db;

    public TicketsController(TrackerDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TicketDto>>> GetAll(CancellationToken cancellationToken)
    {
        var tickets = await _db.Tickets
            .AsNoTracking()
            .Where(t => t.Type != TicketType.ABSENT)
            .OrderBy(t => t.Type)
            .ThenBy(t => t.ExternalKey)
            .Select(t => new TicketDto(t.Id, t.Type, t.ExternalKey, t.Label))
            .ToListAsync(cancellationToken);

        return Ok(tickets);
    }

    [HttpGet("used")]
    public async Task<ActionResult<IReadOnlyList<TicketDto>>> GetUsedByMonth(
        [FromQuery] int year,
        [FromQuery] int month,
        CancellationToken cancellationToken)
    {
        if (month < 1 || month > 12)
            return ApiProblems.BadRequest(this, ApiErrorCodes.MonthInvalid);

        var start = new DateOnly(year, month, 1);
        var end = start.AddMonths(1);

        var tickets = await _db.TimeEntries
            .AsNoTracking()
            .Where(e => e.TicketId != null && e.Date >= start && e.Date < end)
            .Select(e => e.TicketId!.Value)
            .Distinct()
            .Join(
                _db.Tickets.AsNoTracking(),
                ticketId => ticketId,
                t => t.Id,
                (_, t) => t)
            .OrderBy(t => t.Type)
            .ThenBy(t => t.ExternalKey)
            .Select(t => new TicketDto(t.Id, t.Type, t.ExternalKey, t.Label))
            .ToListAsync(cancellationToken);

        return Ok(tickets);
    }

    [HttpPost]
    public async Task<ActionResult<TicketDto>> Create([FromBody] SaveTicketDto dto, CancellationToken cancellationToken)
    {
        if (!Enum.IsDefined(dto.Type))
            return ApiProblems.BadRequest(this, ApiErrorCodes.TicketTypeRequired);

        if (dto.Type == TicketType.ABSENT)
            return ApiProblems.BadRequest(this, ApiErrorCodes.TicketTypeNotAllowed);

        var type = dto.Type;
        var externalKey = string.IsNullOrWhiteSpace(dto.ExternalKey) ? null : dto.ExternalKey.Trim();
        var label = string.IsNullOrWhiteSpace(dto.Label) ? null : dto.Label.Trim();

        if (externalKey != null && string.IsNullOrWhiteSpace(label))
            return ApiProblems.BadRequest(this, ApiErrorCodes.TicketLabelRequired);

        if (externalKey != null)
        {
            var existing = await _db.Tickets
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.ExternalKey == externalKey, cancellationToken);

            if (existing != null)
                return ApiProblems.Conflict(this, ApiErrorCodes.TicketAlreadyExists);
        }

        var entity = new Ticket
        {
            Type = type,
            ExternalKey = externalKey,
            Label = label
        };

        _db.Tickets.Add(entity);
        await _db.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetAll), new { id = entity.Id },
            new TicketDto(entity.Id, entity.Type, entity.ExternalKey, entity.Label));
    }

    [HttpPut("{ticketId:int}")]
    public async Task<ActionResult<TicketDto>> Update(int ticketId, [FromBody] SaveTicketDto dto, CancellationToken cancellationToken)
    {
        if (ticketId <= 0)
            return ApiProblems.BadRequest(this, ApiErrorCodes.TicketIdInvalid);

        var entity = await _db.Tickets.FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken);
        if (entity is null)
            return ApiProblems.NotFound(this, ApiErrorCodes.TicketNotFound);

        if (!Enum.IsDefined(dto.Type))
            return ApiProblems.BadRequest(this, ApiErrorCodes.TicketTypeRequired);

        if (dto.Type == TicketType.ABSENT)
            return ApiProblems.BadRequest(this, ApiErrorCodes.TicketTypeNotAllowed);

        var type = dto.Type;
        var externalKey = string.IsNullOrWhiteSpace(dto.ExternalKey) ? null : dto.ExternalKey.Trim();
        var label = string.IsNullOrWhiteSpace(dto.Label) ? null : dto.Label.Trim();

        if (externalKey != null && string.IsNullOrWhiteSpace(label))
            return ApiProblems.BadRequest(this, ApiErrorCodes.TicketLabelRequired);

        if (externalKey != null)
        {
            var duplicate = await _db.Tickets
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id != ticketId && t.ExternalKey == externalKey, cancellationToken);
            if (duplicate is not null)
                return ApiProblems.Conflict(this, ApiErrorCodes.TicketAlreadyExists);
        }

        entity.Type = type;
        entity.ExternalKey = externalKey;
        entity.Label = label;
        await _db.SaveChangesAsync(cancellationToken);

        return Ok(new TicketDto(entity.Id, entity.Type, entity.ExternalKey, entity.Label));
    }

    [HttpDelete("{ticketId:int}")]
    public async Task<IActionResult> Delete(int ticketId, CancellationToken cancellationToken)
    {
        if (ticketId <= 0)
            return ApiProblems.BadRequest(this, ApiErrorCodes.TicketIdInvalid);

        var ticket = await _db.Tickets.FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken);
        if (ticket is null)
            return ApiProblems.NotFound(this, ApiErrorCodes.TicketNotFound);

        var hasTimeEntries = await _db.TimeEntries
            .AsNoTracking()
            .AnyAsync(e => e.TicketId == ticketId, cancellationToken);
        if (hasTimeEntries)
            return ApiProblems.Conflict(this, ApiErrorCodes.TicketHasTimeEntries);

        _db.Tickets.Remove(ticket);
        await _db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpGet("totals")]
    public async Task<ActionResult<List<TicketTotalDto>>> GetTotals([FromQuery] int? year, [FromQuery] int? month, CancellationToken cancellationToken)
    {
        DateOnly? start = null;
        DateOnly? end = null;

        if (year.HasValue || month.HasValue)
        {
            if (!year.HasValue || !month.HasValue)
                return ApiProblems.BadRequest(this, ApiErrorCodes.FilterYearMonthRequired);

            if (month < 1 || month > 12)
                return ApiProblems.BadRequest(this, ApiErrorCodes.MonthInvalid);

            start = new DateOnly(year.Value, month.Value, 1);
            end = start.Value.AddMonths(1);
        }

        var entriesQuery = _db.TimeEntries.AsNoTracking();
        if (start.HasValue)
            entriesQuery = entriesQuery.Where(e => e.Date >= start.Value && e.Date < end!.Value);

        var result = await _db.Tickets
            .AsNoTracking()
            .GroupJoin(
                entriesQuery,
                t => t.Id,
                e => e.TicketId,
                (t, entries) => new TicketTotalDto
                {
                    TicketId = t.Id,
                    Type = t.Type,
                    ExternalKey = t.ExternalKey ?? "",
                    Label = t.Label ?? "",
                    Total = entries.Sum(e => (int?)e.QuantityMinutes) ?? 0
                })
            .OrderByDescending(x => x.Total)
            .ThenBy(x => x.Type)
            .ThenBy(x => x.ExternalKey)
            .ToListAsync(cancellationToken);

        return Ok(result);
    }

    [HttpGet("{ticketId:int}/detail")]
    public async Task<ActionResult<TicketDetailDto>> GetDetail(int ticketId, CancellationToken cancellationToken)
    {
        if (ticketId <= 0)
            return ApiProblems.BadRequest(this, ApiErrorCodes.TicketIdInvalid);

        var ticket = await _db.Tickets
            .AsNoTracking()
            .Where(t => t.Id == ticketId)
            .Select(t => new TicketDto(t.Id, t.Type, t.ExternalKey, t.Label))
            .FirstOrDefaultAsync(cancellationToken);
        if (ticket is null)
            return ApiProblems.NotFound(this, ApiErrorCodes.TicketNotFound);

        var today = DateOnly.FromDateTime(DateTime.Today);
        var currentMonthStart = new DateOnly(today.Year, today.Month, 1);
        var currentMonthEnd = currentMonthStart.AddMonths(1);
        var prevMonthStart = currentMonthStart.AddMonths(-1);

        var entries = await _db.TimeEntries
            .AsNoTracking()
            .Where(e => e.TicketId == ticketId)
            .OrderByDescending(e => e.Date)
            .Select(e => new TicketTimeEntryDto(e.Date, e.QuantityMinutes))
            .ToListAsync(cancellationToken);

        var totalMinutes = entries.Sum(e => e.QuantityMinutes);
        var currentMonthMinutes = entries
            .Where(e => e.Date >= currentMonthStart && e.Date < currentMonthEnd)
            .Sum(e => e.QuantityMinutes);
        var previousMonthMinutes = entries
            .Where(e => e.Date >= prevMonthStart && e.Date < currentMonthStart)
            .Sum(e => e.QuantityMinutes);

        return Ok(new TicketDetailDto(
            Ticket: ticket,
            Entries: entries,
            TotalMinutes: totalMinutes,
            CurrentMonthMinutes: currentMonthMinutes,
            PreviousMonthMinutes: previousMonthMinutes));
    }
}
