using Tracker.Api.Models;

namespace Tracker.Api.Dtos.Timesheet;

public sealed record TimesheetRowDto
{
    public int TicketId { get; init; }
    public TicketType Type { get; init; }
    public string ExternalKey { get; init; } = "";
    public string Label { get; init; } = "";

    public Dictionary<DateOnly, int> Values { get; init; } = new();
}
