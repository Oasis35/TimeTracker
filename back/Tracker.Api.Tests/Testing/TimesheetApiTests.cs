using System.Net;
using System.Net.Http.Json;
using Tracker.Api.Tests.Testing;
using Xunit;

namespace Tracker.Api.Tests;

public sealed class TimesheetApiTests : IClassFixture<TrackerApiFactory>
{
    private readonly HttpClient _client;

    public TimesheetApiTests(TrackerApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Get_Should_Return_MinutesPerDay_TicketKey_And_Zero_For_Empty_Cells()
    {
        var t1 = await ApiTestHelpers.CreateTicketAsync(_client, "DEV", "64205", "DEV 64205");
        var t2 = await ApiTestHelpers.CreateTicketAsync(_client, "GEN", "", "General");

        await ApiTestHelpers.UpsertAsync(_client, t1, "2026-02-03", 120);
        await ApiTestHelpers.UpsertAsync(_client, t2, "2026-02-01", 60);

        var r = await _client.GetAsync("/api/timesheet?year=2026&month=2");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);

        var dto = await r.Content.ReadFromJsonAsync<TimesheetMonthViewDto>();
        Assert.NotNull(dto);

        Assert.Equal(480, dto!.MinutesPerDay);
        Assert.Contains("2026-02-01", dto.Days);
        Assert.Contains("2026-02-03", dto.Days);

        var dev = Assert.Single(dto.Rows, x => x.Type == "DEV");
        Assert.Equal("DEV-64205", dev.TicketKey);
        Assert.Equal(120, dev.Values["2026-02-03"]);
        Assert.Equal(0, dev.Values["2026-02-01"]);

        var gen = Assert.Single(dto.Rows, x => x.Type == "GEN");
        Assert.Equal("GEN", gen.TicketKey);
        Assert.Equal(60, gen.Values["2026-02-01"]);
        Assert.Equal(0, gen.Values["2026-02-03"]);
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
        string Type,
        string ExternalKey,
        string Label,
        string TicketKey,
        Dictionary<string, int> Values);
}
