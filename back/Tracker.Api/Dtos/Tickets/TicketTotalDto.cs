namespace Tracker.Api.Dtos.Tickets;

public sealed class TicketTotalDto
{
    public required int TicketId { get; init; }
    public required string Type { get; init; }
    public required string ExternalKey { get; init; }
    public required string Label { get; init; }
    public required int Total { get; init; }
}
