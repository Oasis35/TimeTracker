using System.Net;
using System.Net.Http.Json;
using Tracker.Api.Infrastructure;
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

        var c = await ApiTestHelpers.UpsertAsync(_client, ticketId, "2026-02-23", 120, "A");
        Assert.Equal(HttpStatusCode.Created, c.StatusCode);

        var u = await ApiTestHelpers.UpsertAsync(_client, ticketId, "2026-02-23", 240, "B");
        Assert.Equal(HttpStatusCode.NoContent, u.StatusCode);

        var d = await ApiTestHelpers.UpsertAsync(_client, ticketId, "2026-02-23", 0, null);
        Assert.Equal(HttpStatusCode.NoContent, d.StatusCode);

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

        var r1 = await ApiTestHelpers.UpsertAsync(_client, t1, "2026-02-24", 360);
        Assert.True(r1.StatusCode is HttpStatusCode.Created or HttpStatusCode.NoContent);

        var r2 = await ApiTestHelpers.UpsertAsync(_client, t2, "2026-02-24", 180);
        Assert.Equal(HttpStatusCode.BadRequest, r2.StatusCode);
        var p2 = await ReadProblemAsync(r2);
        Assert.Equal(ApiErrorCodes.OverflowDay, GetCode(p2));
    }

    [Fact]
    public async Task Upsert_Should_Allow_Update_Without_DoubleCounting_Existing()
    {
        var t1 = await ApiTestHelpers.CreateTicketAsync(_client, "DEV", "U-4", "U-4");
        var t2 = await ApiTestHelpers.CreateTicketAsync(_client, "DEV", "U-5", "U-5");

        (await ApiTestHelpers.UpsertAsync(_client, t1, "2026-02-25", 240)).EnsureSuccessStatusCode();
        (await ApiTestHelpers.UpsertAsync(_client, t2, "2026-02-25", 240)).EnsureSuccessStatusCode();

        var upd = await ApiTestHelpers.UpsertAsync(_client, t1, "2026-02-25", 120);
        Assert.Equal(HttpStatusCode.NoContent, upd.StatusCode);

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
        var p = await ReadProblemAsync(r);
        var expectedCode = minutes < 0 || minutes > 480
            ? ApiErrorCodes.MinutesOutOfRange
            : ApiErrorCodes.Step15;
        Assert.Equal(expectedCode, GetCode(p));
    }

    [Fact]
    public async Task Upsert_Should_Return_ErrorCode_When_Ticket_Not_Found()
    {
        var r = await ApiTestHelpers.UpsertAsync(_client, ticketId: 999999, date: "2026-02-27", minutes: 120);

        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        var p = await ReadProblemAsync(r);
        Assert.Equal(ApiErrorCodes.TicketNotFound, GetCode(p));
    }

    private static async Task<ApiErrorResponse> ReadProblemAsync(HttpResponseMessage response)
    {
        var problem = await response.Content.ReadFromJsonAsync<ApiErrorResponse>();
        Assert.NotNull(problem);
        return problem!;
    }

    private static string GetCode(ApiErrorResponse problem) => problem.Code;

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
