using System.Net;
using System.Net.Http.Json;
using Tracker.Api.Tests.Testing;
using Xunit;

namespace Tracker.Api.Tests;

public sealed class TimeEntriesUpsertApiTests : IClassFixture<TrackerApiFactory>
{
    private readonly HttpClient _client;

    public TimeEntriesUpsertApiTests(TrackerApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Upsert_Should_Create_Then_Update_Then_Delete()
    {
        var ticketId = await ApiTestHelpers.CreateTicketAsync(_client, "DEV", "U-1", "U-1");

        // Create 120
        var c = await ApiTestHelpers.UpsertAsync(_client, ticketId, "2026-02-23", 120, "A");
        Assert.Equal(HttpStatusCode.Created, c.StatusCode);

        // Update 240
        var u = await ApiTestHelpers.UpsertAsync(_client, ticketId, "2026-02-23", 240, "B");
        Assert.Equal(HttpStatusCode.NoContent, u.StatusCode);

        // Delete 0
        var d = await ApiTestHelpers.UpsertAsync(_client, ticketId, "2026-02-23", 0, null);
        Assert.Equal(HttpStatusCode.NoContent, d.StatusCode);

        // Check day is empty
        var day = await _client.GetAsync("/api/timeentries/day?date=2026-02-23");
        day.EnsureSuccessStatusCode();
        var payload = await day.Content.ReadFromJsonAsync<DayViewDto>();

        Assert.NotNull(payload);
        Assert.Empty(payload!.Entries);
        Assert.Equal(0, payload.TotalMinutes);
        Assert.Equal(480, payload.MinutesPerDay);
    }

    [Fact]
    public async Task Upsert_Should_Reject_When_Total_Exceeds_MinutesPerDay()
    {
        var t1 = await ApiTestHelpers.CreateTicketAsync(_client, "DEV", "U-2", "U-2");
        var t2 = await ApiTestHelpers.CreateTicketAsync(_client, "DEV", "U-3", "U-3");

        var r1 = await ApiTestHelpers.UpsertAsync(_client, t1, "2026-02-24", 360); // 0.75j
        Assert.True(r1.StatusCode is HttpStatusCode.Created or HttpStatusCode.NoContent);

        var r2 = await ApiTestHelpers.UpsertAsync(_client, t2, "2026-02-24", 180); // 0.375j => total 540
        Assert.Equal(HttpStatusCode.BadRequest, r2.StatusCode);
    }

    [Fact]
    public async Task Upsert_Should_Allow_Update_Without_DoubleCounting_Existing()
    {
        var t1 = await ApiTestHelpers.CreateTicketAsync(_client, "DEV", "U-4", "U-4");
        var t2 = await ApiTestHelpers.CreateTicketAsync(_client, "DEV", "U-5", "U-5");

        // Day total: t1=240, t2=240 => 480 (max)
        (await ApiTestHelpers.UpsertAsync(_client, t1, "2026-02-25", 240)).EnsureSuccessStatusCode();
        (await ApiTestHelpers.UpsertAsync(_client, t2, "2026-02-25", 240)).EnsureSuccessStatusCode();

        // Update t1 from 240 to 120 => still ok
        var upd = await ApiTestHelpers.UpsertAsync(_client, t1, "2026-02-25", 120);
        Assert.Equal(HttpStatusCode.NoContent, upd.StatusCode);

        // Now we can increase t2 to 360 (total 480)
        var upd2 = await ApiTestHelpers.UpsertAsync(_client, t2, "2026-02-25", 360);
        Assert.Equal(HttpStatusCode.NoContent, upd2.StatusCode);
    }

    [Theory]
    [InlineData(-15)]
    [InlineData(7)]
    [InlineData(481)]
    public async Task Upsert_Should_Reject_Invalid_Minutes(int minutes)
    {
        var ticketId = await ApiTestHelpers.CreateTicketAsync(_client, "DEV", "U-6", "U-6");

        var r = await ApiTestHelpers.UpsertAsync(_client, ticketId, "2026-02-26", minutes);
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
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
}
