namespace Tracker.Api.Dtos.TimeEntries;

public sealed record DaysExceedingDto
{
    public required int Count { get; init; }
}
