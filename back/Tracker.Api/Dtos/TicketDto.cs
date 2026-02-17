namespace Tracker.Api.Dtos;

public sealed class TicketDto
{
    public required int Id { get; init; }
    public required string Type { get; init; }
    public required string ExternalKey { get; init; }
    public required string Label { get; init; }
}
