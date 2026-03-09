using System.Net.Http.Json;
using Tracker.Api.Models;

namespace Tracker.Api.Tests.Testing;

public static class ApiTestHelpers
{
    public static async Task<int> CreateTicketAsync(HttpClient client, TicketType type, string externalKey, string label)
    {
        var r = await client.PostAsJsonAsync("/api/tickets", new
        {
            type = type.ToString(),
            externalKey,
            label
        });
        r.EnsureSuccessStatusCode();

        var dto = await r.Content.ReadFromJsonAsync<TicketDto>();
        return dto!.Id;
    }

    public static Task<HttpResponseMessage> UpsertAsync(HttpClient client, int ticketId, string date, int minutes, string? comment = null)
        => client.PostAsJsonAsync("/api/timeentries/upsert", new
        {
            ticketId,
            date,
            quantityMinutes = minutes,
            comment
        });

    private sealed record TicketDto(int Id, TicketType Type, string? ExternalKey, string? Label);
}
