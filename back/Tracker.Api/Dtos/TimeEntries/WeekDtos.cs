using Tracker.Api.Models;

namespace Tracker.Api.Dtos.TimeEntries;

public sealed record WeekRowDto(
    int TicketId,
    TicketType Type,
    string? ExternalKey,
    string? Label,
    Dictionary<DateOnly, int> ValuesMinutes,
    int TotalMinutes
);

public sealed record WeekViewDto(
    DateOnly Start,
    IReadOnlyList<DateOnly> Days,
    IReadOnlyList<WeekRowDto> Rows,
    Dictionary<DateOnly, int> TotalsByDay,
    int MinutesPerDay
);
