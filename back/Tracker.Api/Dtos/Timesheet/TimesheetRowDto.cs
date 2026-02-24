public sealed class TimesheetRowDto
{
    public int TicketId { get; set; }
    public string Type { get; set; } = null!;
    public string ExternalKey { get; set; } = "";
    public string Label { get; set; } = "";

    public Dictionary<DateOnly, int> Values { get; set; } = new();
    public int Total { get; set; }
}