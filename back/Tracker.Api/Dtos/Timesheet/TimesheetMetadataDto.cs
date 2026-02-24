namespace Tracker.Api.Dtos.Timesheet;

public sealed record TimesheetMetadataDto(
    int HoursPerDay,
    int MinutesPerDay,
    int[] AllowedMinutesDayMode,
    int[] AllowedMinutesHourMode,
    string DefaultUnit,
    string DefaultType,
    IReadOnlyList<Tracker.Api.Dtos.Tickets.TicketDto> Tickets
);