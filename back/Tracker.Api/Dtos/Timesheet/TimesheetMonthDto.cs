namespace Tracker.Api.Dtos.Timesheet;

public sealed record TimesheetMonthDto
{
    public int Year { get; init; }
    public int Month { get; init; }
    public int MinutesPerDay { get; init; }

    public List<DateOnly> Days { get; init; } = new();
    public List<TimesheetRowDto> Rows { get; init; } = new();
    public Dictionary<DateOnly, int> TotalsByDay { get; init; } = new();
}
