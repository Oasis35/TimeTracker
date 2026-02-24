public sealed class TimesheetMonthDto
{
    public int Year { get; set; }
    public int Month { get; set; }
    public int MinutesPerDay { get; set; }

    public List<DateOnly> Days { get; set; } = new();
    public List<TimesheetRowDto> Rows { get; set; } = new();
    public Dictionary<DateOnly, int> TotalsByDay { get; set; } = new();
}
