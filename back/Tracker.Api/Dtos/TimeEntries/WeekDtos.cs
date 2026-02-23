namespace Tracker.Api.Dtos.TimeEntries;

public sealed record WeekRowDto(
    int TicketId,
    string Type,
    string? ExternalKey,
    string? Label,
    Dictionary<DateOnly, decimal> Values,
    decimal Total
);

public sealed record WeekViewDto(
    DateOnly Start,
    IReadOnlyList<DateOnly> Days,
    IReadOnlyList<WeekRowDto> Rows,
    Dictionary<DateOnly, decimal> TotalsByDay
);
