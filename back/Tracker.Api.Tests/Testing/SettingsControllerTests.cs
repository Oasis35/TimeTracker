using System.Net;
using System.Net.Http.Json;
using Tracker.Api.Tests.Testing;
using Xunit;

namespace Tracker.Api.Tests;

public sealed class SettingsControllerTests : IClassFixture<TrackerApiFactory>, IAsyncLifetime
{
    private readonly TrackerApiFactory _factory;
    private readonly HttpClient _client;

    public SettingsControllerTests(TrackerApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    public Task InitializeAsync() => _factory.ResetDbAsync();
    public Task DisposeAsync() => Task.CompletedTask;

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
        var r = await _client.PutAsJsonAsync("/api/settings/language", new { value = "en" });
        Assert.Equal(HttpStatusCode.NoContent, r.StatusCode);

        var settings = await _client.GetFromJsonAsync<Dictionary<string, string>>("/api/settings");
        Assert.NotNull(settings);
        Assert.Equal("en", settings!["language"]);
    }

    [Fact]
    public async Task Upsert_Should_Update_Existing_Setting()
    {
        await _client.PutAsJsonAsync("/api/settings/unitMode", new { value = "day" });
        var r = await _client.PutAsJsonAsync("/api/settings/unitMode", new { value = "hour" });
        Assert.Equal(HttpStatusCode.NoContent, r.StatusCode);

        var settings = await _client.GetFromJsonAsync<Dictionary<string, string>>("/api/settings");
        Assert.Equal("hour", settings!["unitMode"]);
    }

    [Fact]
    public async Task Upsert_Should_Return_BadRequest_When_Value_Is_Null()
    {
        var r = await _client.PutAsJsonAsync("/api/settings/language", new { value = (string?)null });
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
    public async Task Upsert_Should_Return_BadRequest_When_Key_Is_Not_Allowed()
    {
        var r = await _client.PutAsJsonAsync("/api/settings/arbitraryKey", new { value = "v" });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);

        var body = await r.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.Equal("TT_SETTING_KEY_NOT_ALLOWED", body!["code"]);
    }

    [Fact]
    public async Task Delete_Should_Remove_Setting()
    {
        await _client.PutAsJsonAsync("/api/settings/externalBaseUrl", new { value = "https://example.com/" });

        var r = await _client.DeleteAsync("/api/settings/externalBaseUrl");
        Assert.Equal(HttpStatusCode.NoContent, r.StatusCode);

        var settings = await _client.GetFromJsonAsync<Dictionary<string, string>>("/api/settings");
        Assert.False(settings!.ContainsKey("externalBaseUrl"));
    }

    [Fact]
    public async Task Delete_Should_Return_NoContent_When_Key_Does_Not_Exist()
    {
        var r = await _client.DeleteAsync("/api/settings/language");
        Assert.Equal(HttpStatusCode.NoContent, r.StatusCode);
    }

    [Fact]
    public async Task Delete_Should_Return_BadRequest_When_Key_Is_Not_Allowed()
    {
        var r = await _client.DeleteAsync("/api/settings/arbitraryKey");
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);

        var body = await r.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.Equal("TT_SETTING_KEY_NOT_ALLOWED", body!["code"]);
    }
}
