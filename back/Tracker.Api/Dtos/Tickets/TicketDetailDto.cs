namespace Tracker.Api.Dtos.Tickets;

public sealed record TicketTimeEntryDto(
    DateOnly Date,
    int QuantityMinutes,
    string? Comment
);

public sealed record TicketDetailDto(
    TicketDto Ticket,
    IReadOnlyList<TicketTimeEntryDto> Entries,
    int TotalMinutes
);
