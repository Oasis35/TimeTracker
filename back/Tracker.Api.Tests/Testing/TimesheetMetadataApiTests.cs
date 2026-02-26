using System.Net;
using System.Net.Http.Json;
using Tracker.Api.Tests.Testing;
using Xunit;

namespace Tracker.Api.Tests;

public sealed class TimesheetMetadataApiTests : IClassFixture<TrackerApiFactory>
{
    private readonly HttpClient _client;

    public TimesheetMetadataApiTests(TrackerApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Metadata_Should_Return_HoursPerDay_MinutesPerDay_And_AllowedMinutes()
    {
        // Arrange
        // Act
        var r = await _client.GetAsync("/api/timesheet/metadata");

        // Assert
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);

        var meta = await r.Content.ReadFromJsonAsync<MetadataDto>();
        Assert.NotNull(meta);

        Assert.Equal(8, meta!.HoursPerDay);
        Assert.Equal(480, meta.MinutesPerDay);

        // Day mode: 0, 120, 240, 360, 480
        Assert.Equal(new[] { 0, 120, 240, 360, 480 }, meta.AllowedMinutesDayMode);

        // Hour mode: multiple of 30, includes 0 and 480
        Assert.Contains(0, meta.AllowedMinutesHourMode);
        Assert.Contains(480, meta.AllowedMinutesHourMode);
        Assert.All(meta.AllowedMinutesHourMode, m => Assert.True(m % 30 == 0));

        Assert.Equal("day", meta.DefaultUnit);
        Assert.False(string.IsNullOrWhiteSpace(meta.DefaultType));
    }

    private sealed record MetadataDto(
        int HoursPerDay,
        int MinutesPerDay,
        int[] AllowedMinutesDayMode,
        int[] AllowedMinutesHourMode,
        string DefaultUnit,
        string DefaultType
    );
}
