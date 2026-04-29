using System.Net;
using System.Net.Http.Json;
using Tracker.Api.Models;
using Tracker.Api.Tests.Testing;
using Xunit;

namespace Tracker.Api.Tests;

public sealed class TimesheetApiTests : IClassFixture<TrackerApiFactory>, IAsyncLifetime
{
    private readonly TrackerApiFactory _factory;
    private readonly HttpClient _client;

    public TimesheetApiTests(TrackerApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    public Task InitializeAsync() => _factory.ResetDbAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Get_Should_Return_MinutesPerDay_And_Zero_For_Empty_Cells()
    {
        var t1 = await ApiTestHelpers.CreateTicketAsync(_client, TicketType.DEV, "64205", "DEV 64205");
        var t2 = await ApiTestHelpers.CreateTicketAsync(_client, TicketType.SUPPORT, "", "General");

        await ApiTestHelpers.UpsertAsync(_client, t1, "2026-02-03", 120);
        await ApiTestHelpers.UpsertAsync(_client, t2, "2026-02-01", 60);

        var r = await _client.GetAsync("/api/timesheet?year=2026&month=2");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);

        var dto = await r.Content.ReadFromJsonAsync<TimesheetMonthViewDto>();
        Assert.NotNull(dto);

        Assert.Equal(480, dto!.MinutesPerDay);
        Assert.Contains("2026-02-01", dto.Days);
        Assert.Contains("2026-02-03", dto.Days);

        var dev = Assert.Single(dto.Rows, x => x.Type == TicketType.DEV);
        Assert.Equal(120, dev.Values["2026-02-03"]);
        Assert.Equal(0, dev.Values["2026-02-01"]);

        var support = Assert.Single(dto.Rows, x => x.Type == TicketType.SUPPORT);
        Assert.Equal(60, support.Values["2026-02-01"]);
        Assert.Equal(0, support.Values["2026-02-03"]);
    }

    [Fact]
    public async Task Get_Should_Return_Correct_TotalsByDay()
    {
        var t1 = await ApiTestHelpers.CreateTicketAsync(_client, TicketType.DEV, "TS-TOT-1", "Ticket 1");
        var t2 = await ApiTestHelpers.CreateTicketAsync(_client, TicketType.DEV, "TS-TOT-2", "Ticket 2");

        await ApiTestHelpers.UpsertAsync(_client, t1, "2026-04-01", 120);
        await ApiTestHelpers.UpsertAsync(_client, t2, "2026-04-01", 240);
        await ApiTestHelpers.UpsertAsync(_client, t1, "2026-04-02", 480);

        var r = await _client.GetAsync("/api/timesheet?year=2026&month=4");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);

        var dto = await r.Content.ReadFromJsonAsync<TimesheetMonthViewDto>();
        Assert.NotNull(dto);

        // Day 1: 120 + 240 = 360
        Assert.Equal(360, dto!.TotalsByDay["2026-04-01"]);
        // Day 2: 480
        Assert.Equal(480, dto.TotalsByDay["2026-04-02"]);
    }

    [Fact]
    public async Task Get_Should_Return_Empty_Rows_For_Month_With_No_Entries()
    {
        var r = await _client.GetAsync("/api/timesheet?year=2099&month=1");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);

        var dto = await r.Content.ReadFromJsonAsync<TimesheetMonthViewDto>();
        Assert.NotNull(dto);
        Assert.Empty(dto!.Rows);
        Assert.Equal(31, dto.Days.Count);
    }

    private sealed record TimesheetMonthViewDto(
        int Year,
        int Month,
        int MinutesPerDay,
        List<string> Days,
        List<TimesheetRowViewDto> Rows,
        Dictionary<string, int> TotalsByDay);

    private sealed record TimesheetRowViewDto(
        int TicketId,
        TicketType Type,
        string ExternalKey,
        string Label,
        Dictionary<string, int> Values);
}
