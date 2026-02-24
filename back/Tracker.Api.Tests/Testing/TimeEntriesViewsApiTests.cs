using System.Net.Http.Json;
using Tracker.Api.Tests.Testing;
using Xunit;

namespace Tracker.Api.Tests;

public sealed class TimeEntriesViewsApiTests : IClassFixture<TrackerApiFactory>
{
    private readonly HttpClient _client;

    public TimeEntriesViewsApiTests(TrackerApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetDay_Should_Group_By_Ticket_And_Return_Total()
    {
        var t1 = await ApiTestHelpers.CreateTicketAsync(_client, "DEV", "D-1", "D-1");
        var t2 = await ApiTestHelpers.CreateTicketAsync(_client, "DEV", "D-2", "D-2");

        await ApiTestHelpers.UpsertAsync(_client, t1, "2026-02-23", 120);
        await ApiTestHelpers.UpsertAsync(_client, t2, "2026-02-23", 240);

        var r = await _client.GetAsync("/api/timeentries/day?date=2026-02-23");
        r.EnsureSuccessStatusCode();

        var dto = await r.Content.ReadFromJsonAsync<DayViewDto>();
        Assert.NotNull(dto);

        Assert.Equal(2, dto!.Entries.Count);
        Assert.Equal(360, dto.TotalMinutes);
        Assert.Equal(480, dto.MinutesPerDay);
    }

    [Fact]
    public async Task GetWeek_Should_Return_7_Days_And_TotalsByDay()
    {
        var t1 = await ApiTestHelpers.CreateTicketAsync(_client, "DEV", "W-1", "W-1");

        // Start = 2026-02-18 (Wednesday) => monday = 2026-02-16
        await ApiTestHelpers.UpsertAsync(_client, t1, "2026-02-16", 120);
        await ApiTestHelpers.UpsertAsync(_client, t1, "2026-02-17", 240);

        var r = await _client.GetAsync("/api/timeentries/week?start=2026-02-18");
        r.EnsureSuccessStatusCode();

        var dto = await r.Content.ReadFromJsonAsync<WeekViewDto>();
        Assert.NotNull(dto);

        Assert.Equal(7, dto!.Days.Count);
        Assert.Equal(480, dto.MinutesPerDay);

        // TotalsByDay contains at least those two days
        Assert.Equal(120, dto.TotalsByDay["2026-02-16"]);
        Assert.Equal(240, dto.TotalsByDay["2026-02-17"]);
    }

    private sealed record DayViewDto(
        string Date,
        List<DayEntryDto> Entries,
        int TotalMinutes,
        int MinutesPerDay);

    private sealed record DayEntryDto(
        int TicketId,
        string Type,
        string? ExternalKey,
        string? Label,
        int QuantityMinutes);

    private sealed record WeekViewDto(
        string Start,
        List<string> Days,
        List<object> Rows,
        Dictionary<string, int> TotalsByDay,
        int MinutesPerDay);
}