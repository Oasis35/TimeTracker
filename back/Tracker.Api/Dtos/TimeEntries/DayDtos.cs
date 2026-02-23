namespace Tracker.Api.Dtos.TimeEntries;

public sealed record DayEntryDto(
    int TicketId,
    string Type,
    string? ExternalKey,
    string? Label,
    decimal Quantity
);

public sealed record DayViewDto(
    DateOnly Date,
    IReadOnlyList<DayEntryDto> Entries,
    decimal Total
);
