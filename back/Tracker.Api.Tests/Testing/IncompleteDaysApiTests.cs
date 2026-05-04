using System.Net;
using System.Net.Http.Json;
using Tracker.Api.Models;
using Tracker.Api.Tests.Testing;
using Xunit;

namespace Tracker.Api.Tests;

public sealed class IncompleteDaysApiTests : IClassFixture<TrackerApiFactory>, IAsyncLifetime
{
    private readonly TrackerApiFactory _factory;
    private readonly HttpClient _client;

    // Use a Monday from last week so the date is always in the 30-day window
    // and is guaranteed to be a weekday (not a public holiday in test env).
    private static DateOnly RecentMonday()
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        // Walk back to last Monday (never today, since today is excluded)
        var d = today.AddDays(-1);
        while (d.DayOfWeek != DayOfWeek.Monday)
            d = d.AddDays(-1);
        return d;
    }

    public IncompleteDaysApiTests(TrackerApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    public Task InitializeAsync() => _factory.ResetDbAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Returns_200_With_Empty_List_When_All_Days_Complete()
    {
        var monday = RecentMonday();
        var mondayStr = monday.ToString("yyyy-MM-dd");

        var ticketId = await ApiTestHelpers.CreateTicketAsync(_client, TicketType.DEV, "INC-1", "Test");
        await ApiTestHelpers.UpsertAsync(_client, ticketId, mondayStr, 480);

        var r = await _client.GetAsync("/api/timesheet/incomplete-days");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);

        var dto = await r.Content.ReadFromJsonAsync<IncompleteDaysViewDto>();
        Assert.NotNull(dto);
        Assert.DoesNotContain(mondayStr, dto!.IncompleteDays);
    }

    [Fact]
    public async Task Returns_Day_When_Total_Below_MinutesPerDay()
    {
        var monday = RecentMonday();
        var mondayStr = monday.ToString("yyyy-MM-dd");

        var ticketId = await ApiTestHelpers.CreateTicketAsync(_client, TicketType.DEV, "INC-2", "Test");
        await ApiTestHelpers.UpsertAsync(_client, ticketId, mondayStr, 240); // half day

        var r = await _client.GetAsync("/api/timesheet/incomplete-days");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);

        var dto = await r.Content.ReadFromJsonAsync<IncompleteDaysViewDto>();
        Assert.NotNull(dto);
        Assert.Contains(mondayStr, dto!.IncompleteDays);
    }

    [Fact]
    public async Task Does_Not_Return_Today()
    {
        var today = DateOnly.FromDateTime(DateTime.Today).ToString("yyyy-MM-dd");

        var r = await _client.GetAsync("/api/timesheet/incomplete-days");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);

        var dto = await r.Content.ReadFromJsonAsync<IncompleteDaysViewDto>();
        Assert.NotNull(dto);
        Assert.DoesNotContain(today, dto!.IncompleteDays);
    }

    [Fact]
    public async Task Returns_Day_With_No_Entry_As_Incomplete()
    {
        var monday = RecentMonday();
        var mondayStr = monday.ToString("yyyy-MM-dd");

        // No entries at all — monday should appear as incomplete
        var r = await _client.GetAsync("/api/timesheet/incomplete-days");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);

        var dto = await r.Content.ReadFromJsonAsync<IncompleteDaysViewDto>();
        Assert.NotNull(dto);
        Assert.Contains(mondayStr, dto!.IncompleteDays);
    }

    private sealed record IncompleteDaysViewDto(List<string> IncompleteDays);
}
