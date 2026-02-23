namespace Tracker.Api.Dtos.Timesheet;

public sealed record TimesheetMetadataDto(
    decimal[] AllowedQuantities,
    string DefaultType,
    IReadOnlyList<Tracker.Api.Dtos.Tickets.TicketDto> Tickets
);
