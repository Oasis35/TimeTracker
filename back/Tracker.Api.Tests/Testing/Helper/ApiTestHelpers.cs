using System.Net.Http.Json;

namespace Tracker.Api.Tests.Testing;

public static class ApiTestHelpers
{
    public static async Task<int> CreateTicketAsync(HttpClient client, string type, string externalKey, string label)
    {
        var r = await client.PostAsJsonAsync("/api/tickets", new
        {
            type,
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

    private sealed record TicketDto(int Id, string Type, string? ExternalKey, string? Label);
}