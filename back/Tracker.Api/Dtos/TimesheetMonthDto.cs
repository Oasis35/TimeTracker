namespace Tracker.Api.Dtos;

public sealed class TimesheetMonthDto
{
    public required int Year { get; init; }
    public required int Month { get; init; }
    public required List<DateOnly> Days { get; init; }
    public required List<TimesheetRowDto> Rows { get; init; }
    public required Dictionary<DateOnly, decimal> TotalsByDay { get; init; }
}
