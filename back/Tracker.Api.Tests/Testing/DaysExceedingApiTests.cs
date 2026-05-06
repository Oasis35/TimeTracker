using System.Net;
using System.Net.Http.Json;
using Tracker.Api.Models;
using Tracker.Api.Tests.Testing;
using Xunit;

namespace Tracker.Api.Tests;

public sealed class DaysExceedingApiTests : IClassFixture<TrackerApiFactory>, IAsyncLifetime
{
    private readonly TrackerApiFactory _factory;
    private readonly HttpClient _client;

    public DaysExceedingApiTests(TrackerApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    public Task InitializeAsync() => _factory.ResetDbAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Returns_Zero_When_No_Entries()
    {
        var r = await _client.GetAsync("/api/timeentries/days-exceeding?minutes=420");

        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var dto = await r.Content.ReadFromJsonAsync<DaysExceedingDto>();
        Assert.Equal(0, dto!.Count);
    }

    [Fact]
    public async Task Returns_Zero_When_No_Day_Exceeds_Limit()
    {
        var ticketId = await ApiTestHelpers.CreateTicketAsync(_client, TicketType.DEV, "DE-1", "DE-1");
        (await ApiTestHelpers.UpsertAsync(_client, ticketId, "2026-03-10", 420)).EnsureSuccessStatusCode();

        var r = await _client.GetAsync("/api/timeentries/days-exceeding?minutes=420");

        var dto = await r.Content.ReadFromJsonAsync<DaysExceedingDto>();
        Assert.Equal(0, dto!.Count);
    }

    [Fact]
    public async Task Returns_Count_Of_Days_Strictly_Exceeding_Limit()
    {
        var t1 = await ApiTestHelpers.CreateTicketAsync(_client, TicketType.DEV, "DE-2", "DE-2");
        var t2 = await ApiTestHelpers.CreateTicketAsync(_client, TicketType.DEV, "DE-3", "DE-3");

        // day 11 : 240 + 240 = 480  → dépasse 420
        (await ApiTestHelpers.UpsertAsync(_client, t1, "2026-03-11", 240)).EnsureSuccessStatusCode();
        (await ApiTestHelpers.UpsertAsync(_client, t2, "2026-03-11", 240)).EnsureSuccessStatusCode();

        // day 12 : 420 exactement → ne dépasse pas
        (await ApiTestHelpers.UpsertAsync(_client, t1, "2026-03-12", 420)).EnsureSuccessStatusCode();

        // day 13 : 480 → dépasse 420
        (await ApiTestHelpers.UpsertAsync(_client, t1, "2026-03-13", 480)).EnsureSuccessStatusCode();

        var r = await _client.GetAsync("/api/timeentries/days-exceeding?minutes=420");

        var dto = await r.Content.ReadFromJsonAsync<DaysExceedingDto>();
        Assert.Equal(2, dto!.Count);
    }

    [Fact]
    public async Task Returns_BadRequest_When_Minutes_Is_Zero()
    {
        var r = await _client.GetAsync("/api/timeentries/days-exceeding?minutes=0");

        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
    }

    private sealed record DaysExceedingDto(int Count);
}
