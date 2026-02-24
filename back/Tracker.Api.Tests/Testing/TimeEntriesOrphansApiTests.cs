using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using Tracker.Api.Data;
using Tracker.Api.Models;
using Tracker.Api.Tests.Testing;
using Xunit;

namespace Tracker.Api.Tests;

public sealed class TimeEntriesOrphansApiTests : IClassFixture<TrackerApiFactory>
{
    private readonly TrackerApiFactory _factory;
    private readonly HttpClient _client;

    public TimeEntriesOrphansApiTests(TrackerApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetDay_Should_Ignore_Entries_With_Null_TicketId()
    {
        // Arrange: on insère une entrée orpheline directement en DB
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrackerDbContext>();
            db.TimeEntries.Add(new TimeEntry
            {
                TicketId = null,
                Date = new DateOnly(2026, 2, 23),
                QuantityMinutes = 120,
                Comment = "orphan"
            });
            await db.SaveChangesAsync();
        }

        // Act
        var r = await _client.GetAsync("/api/timeentries/day?date=2026-02-23");
        r.EnsureSuccessStatusCode();

        var dto = await r.Content.ReadFromJsonAsync<DayViewDto>();
        Assert.NotNull(dto);

        // Assert: aucune entrée visible, total = 0
        Assert.Empty(dto!.Entries);
        Assert.Equal(0, dto.TotalMinutes);
    }

    private sealed record DayViewDto(
        string Date,
        List<object> Entries,
        int TotalMinutes,
        int MinutesPerDay);
}