using Tracker.Api.Dtos.Tickets;
using Tracker.Api.Models;

namespace Tracker.Api.Dtos.Timesheet;

public sealed record TimesheetMetadataDto
{
    public required int HoursPerDay { get; init; }
    public required int MinutesPerDay { get; init; }
    public required int[] AllowedMinutesDayMode { get; init; }
    public required int[] AllowedMinutesHourMode { get; init; }
    public required string DefaultUnit { get; init; }
    public required TicketType DefaultType { get; init; }
    public required IReadOnlyList<TicketDto> Tickets { get; init; }
}
