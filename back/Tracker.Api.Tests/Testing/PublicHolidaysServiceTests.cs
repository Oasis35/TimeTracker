using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Tracker.Api.Services;
using Xunit;

namespace Tracker.Api.Tests;

public sealed class PublicHolidaysServiceTests
{
    // ——————————————————————————————————————
    // Helpers
    // ——————————————————————————————————————

    private static PublicHolidaysService CreateService(HttpMessageHandler handler)
    {
        var factory = new FakeHttpClientFactory(handler);
        return new PublicHolidaysService(factory, NullLogger<PublicHolidaysService>.Instance);
    }

    private static string ToJson(Dictionary<string, string> dict) =>
        JsonSerializer.Serialize(dict);

    // ——————————————————————————————————————
    // Fetch and deserialize
    // ——————————————————————————————————————

    [Fact]
    public async Task GetAsync_Should_Fetch_And_Deserialize_Holidays()
    {
        var holidays = new Dictionary<string, string>
        {
            ["2026-01-01"] = "Jour de l'An",
            ["2026-05-01"] = "Fête du Travail",
        };
        var service = CreateService(new FakeHttpHandler(ToJson(holidays)));

        var result = await service.GetAsync();

        Assert.Equal(2, result.Count);
        Assert.Equal("Jour de l'An", result["2026-01-01"]);
        Assert.Equal("Fête du Travail", result["2026-05-01"]);
    }

    [Fact]
    public async Task GetAsync_Should_Return_Empty_When_Api_Returns_Empty_Json()
    {
        var service = CreateService(new FakeHttpHandler("{}"));

        var result = await service.GetAsync();

        Assert.Empty(result);
    }

    // ——————————————————————————————————————
    // Caching
    // ——————————————————————————————————————

    [Fact]
    public async Task GetAsync_Should_Cache_Result_And_Not_Fetch_Twice_Within_Ttl()
    {
        var callCount = 0;
        var handler = new CountingHttpHandler(ToJson(new Dictionary<string, string>
        {
            ["2026-01-01"] = "Jour de l'An"
        }), () => callCount++);

        var service = CreateService(handler);

        await service.GetAsync();
        await service.GetAsync();
        await service.GetAsync();

        Assert.Equal(1, callCount);
    }

    [Fact]
    public async Task GetAsync_Should_Refetch_After_Ttl_Expires()
    {
        var callCount = 0;
        var handler = new CountingHttpHandler(ToJson(new Dictionary<string, string>
        {
            ["2026-01-01"] = "Jour de l'An"
        }), () => callCount++);

        var service = CreateService(handler);

        await service.GetAsync();
        // Simulate TTL expiry by backdating _cachedAt
        SetCachedAt(service, DateTime.UtcNow.AddHours(-25));
        await service.GetAsync();

        Assert.Equal(2, callCount);
    }

    [Fact]
    public async Task GetAsync_Should_Not_Refetch_Just_Before_Ttl_Expires()
    {
        var callCount = 0;
        var handler = new CountingHttpHandler(ToJson(new Dictionary<string, string>
        {
            ["2026-01-01"] = "Jour de l'An"
        }), () => callCount++);

        var service = CreateService(handler);

        await service.GetAsync();
        // 23h59m ago — still within 24h TTL
        SetCachedAt(service, DateTime.UtcNow.AddHours(-23).AddMinutes(-59));
        await service.GetAsync();

        Assert.Equal(1, callCount);
    }

    // ——————————————————————————————————————
    // Error handling
    // ——————————————————————————————————————

    [Fact]
    public async Task GetAsync_Should_Return_Empty_When_Api_Throws_On_First_Call()
    {
        var service = CreateService(new FailingHttpHandler());

        var result = await service.GetAsync();

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetAsync_Should_Return_Cached_Data_When_Api_Fails_After_Successful_Load()
    {
        var callCount = 0;
        var handler = new FlipFlopHttpHandler(
            firstResponse: ToJson(new Dictionary<string, string> { ["2026-01-01"] = "Jour de l'An" }),
            onCall: () => callCount++);

        var service = CreateService(handler);

        // First call: success → cached
        var first = await service.GetAsync();
        Assert.Single(first);

        // Expire the cache then trigger a failing refresh
        SetCachedAt(service, DateTime.UtcNow.AddHours(-25));
        var second = await service.GetAsync();

        // Should return the previously cached data
        Assert.Single(second);
        Assert.Equal("Jour de l'An", second["2026-01-01"]);
        Assert.Equal(2, callCount);
    }

    // ——————————————————————————————————————
    // Reflection helper
    // ——————————————————————————————————————

    private static void SetCachedAt(PublicHolidaysService service, DateTime value)
    {
        var field = typeof(PublicHolidaysService).GetField(
            "_cachedAt",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!;
        field.SetValue(service, value);
    }

    // ——————————————————————————————————————
    // Fakes
    // ——————————————————————————————————————

    private sealed class FakeHttpClientFactory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler);
    }

    private sealed class FakeHttpHandler(string responseBody) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(responseBody, Encoding.UTF8, "application/json")
            });
    }

    private sealed class CountingHttpHandler(string responseBody, Action onCall) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            onCall();
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(responseBody, Encoding.UTF8, "application/json")
            });
        }
    }

    private sealed class FailingHttpHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) =>
            throw new HttpRequestException("Network error");
    }

    /// Second and subsequent calls throw to simulate a transient failure after first success.
    private sealed class FlipFlopHttpHandler(string firstResponse, Action onCall) : HttpMessageHandler
    {
        private int _callCount;

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            onCall();
            if (Interlocked.Increment(ref _callCount) == 1)
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(firstResponse, Encoding.UTF8, "application/json")
                });
            throw new HttpRequestException("Network error");
        }
    }
}
