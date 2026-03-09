using Tracker.Api.Models;

namespace Tracker.Api.Dtos.TimeEntries;

public sealed record DayEntryDto(
    int TicketId,
    TicketType Type,
    string? ExternalKey,
    string? Label,
    int QuantityMinutes
);

public sealed record DayViewDto(
    DateOnly Date,
    IReadOnlyList<DayEntryDto> Entries,
    int TotalMinutes,
    int MinutesPerDay
);
