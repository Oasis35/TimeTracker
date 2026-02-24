public sealed record DayEntryDto(
    int TicketId,
    string Type,
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