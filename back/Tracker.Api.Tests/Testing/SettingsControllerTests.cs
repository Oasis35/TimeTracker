using System.Net;
using System.Net.Http.Json;
using Tracker.Api.Tests.Testing;
using Xunit;

namespace Tracker.Api.Tests;

public sealed class SettingsControllerTests : IClassFixture<TrackerApiFactory>
{
    private readonly HttpClient _client;

    public SettingsControllerTests(TrackerApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetAll_Should_Return_Empty_Dictionary_When_No_Settings()
    {
        var r = await _client.GetAsync("/api/settings");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);

        var settings = await r.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.NotNull(settings);
    }

    [Fact]
    public async Task Upsert_Should_Create_Setting()
    {
        var key = "test-create-" + Guid.NewGuid().ToString("N")[..8];

        var r = await _client.PutAsJsonAsync($"/api/settings/{key}", new { value = "hello" });
        Assert.Equal(HttpStatusCode.NoContent, r.StatusCode);

        var settings = await _client.GetFromJsonAsync<Dictionary<string, string>>("/api/settings");
        Assert.NotNull(settings);
        Assert.Equal("hello", settings![key]);
    }

    [Fact]
    public async Task Upsert_Should_Update_Existing_Setting()
    {
        var key = "test-update-" + Guid.NewGuid().ToString("N")[..8];

        await _client.PutAsJsonAsync($"/api/settings/{key}", new { value = "first" });
        var r = await _client.PutAsJsonAsync($"/api/settings/{key}", new { value = "second" });
        Assert.Equal(HttpStatusCode.NoContent, r.StatusCode);

        var settings = await _client.GetFromJsonAsync<Dictionary<string, string>>("/api/settings");
        Assert.Equal("second", settings![key]);
    }

    [Fact]
    public async Task Upsert_Should_Return_BadRequest_When_Value_Is_Null()
    {
        var r = await _client.PutAsJsonAsync("/api/settings/somekey", new { value = (string?)null });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
    }

    [Fact]
    public async Task Upsert_Should_Return_BadRequest_When_Key_Is_Too_Long()
    {
        var longKey = new string('x', 65);
        var r = await _client.PutAsJsonAsync($"/api/settings/{longKey}", new { value = "v" });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
    }

    [Fact]
    public async Task Delete_Should_Remove_Setting()
    {
        var key = "test-delete-" + Guid.NewGuid().ToString("N")[..8];

        await _client.PutAsJsonAsync($"/api/settings/{key}", new { value = "to-delete" });

        var r = await _client.DeleteAsync($"/api/settings/{key}");
        Assert.Equal(HttpStatusCode.NoContent, r.StatusCode);

        var settings = await _client.GetFromJsonAsync<Dictionary<string, string>>("/api/settings");
        Assert.False(settings!.ContainsKey(key));
    }

    [Fact]
    public async Task Delete_Should_Return_NoContent_Even_When_Key_Does_Not_Exist()
    {
        var r = await _client.DeleteAsync("/api/settings/nonexistent-key-xyz");
        Assert.Equal(HttpStatusCode.NoContent, r.StatusCode);
    }
}
