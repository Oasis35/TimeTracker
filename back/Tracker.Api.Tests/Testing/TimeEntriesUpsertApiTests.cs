using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using Tracker.Api.Data;
using Tracker.Api.Infrastructure;
using Tracker.Api.Models;
using Tracker.Api.Tests.Testing;
using Xunit;

namespace Tracker.Api.Tests;

public sealed class TimeEntriesUpsertApiTests : IClassFixture<TrackerApiFactory>, IAsyncLifetime
{
    private readonly TrackerApiFactory _factory;
    private readonly HttpClient _client;

    public TimeEntriesUpsertApiTests(TrackerApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    public Task InitializeAsync() => _factory.ResetDbAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Upsert_Should_Create_Then_Update_Then_Delete()
    {
        var ticketId = await ApiTestHelpers.CreateTicketAsync(_client, TicketType.DEV, "U-1", "U-1");

        var c = await ApiTestHelpers.UpsertAsync(_client, ticketId, "2026-02-23", 120);
        Assert.Equal(HttpStatusCode.Created, c.StatusCode);

        var u = await ApiTestHelpers.UpsertAsync(_client, ticketId, "2026-02-23", 240);
        Assert.Equal(HttpStatusCode.NoContent, u.StatusCode);

        var d = await ApiTestHelpers.UpsertAsync(_client, ticketId, "2026-02-23", 0);
        Assert.Equal(HttpStatusCode.NoContent, d.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrackerDbContext>();
        var remainingEntries = db.TimeEntries.Where(e => e.TicketId == ticketId && e.Date == new DateOnly(2026, 2, 23));
        Assert.Empty(remainingEntries);
    }

    [Fact]
    public async Task Upsert_Should_Reject_When_Total_Exceeds_MinutesPerDay()
    {
        var t1 = await ApiTestHelpers.CreateTicketAsync(_client, TicketType.DEV, "U-2", "U-2");
        var t2 = await ApiTestHelpers.CreateTicketAsync(_client, TicketType.DEV, "U-3", "U-3");

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
        var t1 = await ApiTestHelpers.CreateTicketAsync(_client, TicketType.DEV, "U-4", "U-4");
        var t2 = await ApiTestHelpers.CreateTicketAsync(_client, TicketType.DEV, "U-5", "U-5");

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
        var ticketId = await ApiTestHelpers.CreateTicketAsync(_client, TicketType.DEV, $"U-INV-{minutes}", $"U-INV-{minutes}");

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

        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
        var p = await ReadProblemAsync(r);
        Assert.Equal(ApiErrorCodes.TicketNotFound, GetCode(p));
    }

    [Fact]
    public async Task Upsert_Should_Return_ErrorCode_When_Ticket_Is_Completed()
    {
        var ticketId = await ApiTestHelpers.CreateTicketAsync(_client, TicketType.DEV, "U-LOCK-1", "U-LOCK-1");
        (await ApiTestHelpers.UpsertAsync(_client, ticketId, "2026-02-27", 120)).EnsureSuccessStatusCode();

        var completion = await _client.PatchAsJsonAsync($"/api/tickets/{ticketId}/completion", new { isCompleted = true });
        completion.EnsureSuccessStatusCode();

        var upsert = await ApiTestHelpers.UpsertAsync(_client, ticketId, "2026-02-28", 60);
        Assert.Equal(HttpStatusCode.Conflict, upsert.StatusCode);
        var problem = await ReadProblemAsync(upsert);
        Assert.Equal(ApiErrorCodes.TicketCompletedLocked, GetCode(problem));
    }

    [Fact]
    public async Task Upsert_Should_Accept_Exactly_MinutesPerDay()
    {
        var ticketId = await ApiTestHelpers.CreateTicketAsync(_client, TicketType.DEV, "U-MAX", "U-MAX");

        var r = await ApiTestHelpers.UpsertAsync(_client, ticketId, "2026-03-01", 480);

        Assert.True(r.StatusCode is HttpStatusCode.Created or HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Upsert_Should_Reject_One_Minute_Above_MinutesPerDay()
    {
        var ticketId = await ApiTestHelpers.CreateTicketAsync(_client, TicketType.DEV, "U-OVER", "U-OVER");

        var r = await ApiTestHelpers.UpsertAsync(_client, ticketId, "2026-03-02", 481);

        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        var p = await ReadProblemAsync(r);
        Assert.Equal(ApiErrorCodes.MinutesOutOfRange, GetCode(p));
    }

    private static async Task<ApiErrorResponse> ReadProblemAsync(HttpResponseMessage response)
    {
        var problem = await response.Content.ReadFromJsonAsync<ApiErrorResponse>();
        Assert.NotNull(problem);
        return problem!;
    }

    private static string GetCode(ApiErrorResponse problem) => problem.Code;
}
