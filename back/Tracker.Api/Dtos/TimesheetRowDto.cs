namespace Tracker.Api.Dtos
{
    public sealed class TimesheetRowDto
    {
        public required int TicketId { get; init; }
        public required string Type { get; init; }
        public required string ExternalKey { get; init; }
        public required string Label { get; init; }
        public required Dictionary<DateOnly, decimal> Values { get; init; }
        public required decimal Total { get; init; }
    }
}
