namespace Tracker.Api.Dtos.TimeEntries;

public sealed class UpsertTimeEntryDto
{
    public required int TicketId { get; init; }
    public required DateOnly Date { get; init; }
    public required decimal Quantity { get; init; }
    public string? Comment { get; init; }
}
