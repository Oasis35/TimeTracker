namespace Tracker.Api.Dtos.Tickets;

public sealed record TicketDto(int Id, string Type, string? ExternalKey, string? Label);

public sealed record CreateTicketDto(string Type, string? ExternalKey, string? Label);
