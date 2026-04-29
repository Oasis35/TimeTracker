using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Tracker.Api.Data;
using Tracker.Api.Infrastructure;
using Tracker.Api.Models;
using Tracker.Api.Services;
using Tracker.Api.Tests.Testing;
using Xunit;

namespace Tracker.Api.Tests;

public sealed class BackupControllerApiTests : IAsyncLifetime
{
    private string? _tempRoot;
    private string? _dbPath;
    private WebApplicationFactory<Program>? _factory;
    private HttpClient? _client;

    public async Task InitializeAsync()
    {
        _tempRoot = Path.Combine(Path.GetTempPath(), $"backup-api-tests-{Guid.NewGuid():N}");
        Directory.CreateDirectory(_tempRoot);
        _dbPath = Path.Combine(_tempRoot, "tracker.db");

        var options = new DbContextOptionsBuilder<TrackerDbContext>()
            .UseSqlite($"Data Source={_dbPath}")
            .Options;
        await using (var db = new TrackerDbContext(options))
        {
            await db.Database.EnsureCreatedAsync();
            db.Tickets.Add(new Ticket { Type = TicketType.DEV, ExternalKey = "BKP-1", Label = "Backup test ticket" });
            await db.SaveChangesAsync();
        }
        SqliteConnection.ClearAllPools();

        var dbPath = _dbPath;
        var tempRoot = _tempRoot;

        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");

            builder.ConfigureAppConfiguration((_, config) =>
            {
                config.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Main"] = $"Data Source={dbPath}",
                    ["TimeTracking:MinutesPerDay"] = "480"
                });
            });

            builder.ConfigureServices(services =>
            {
                var existing = services.SingleOrDefault(d => d.ServiceType == typeof(DatabaseBackupService));
                if (existing is not null) services.Remove(existing);

                services.AddSingleton(_ =>
                {
                    var config = new ConfigurationBuilder()
                        .AddInMemoryCollection(new Dictionary<string, string?>
                        {
                            ["ConnectionStrings:Main"] = $"Data Source={dbPath}"
                        })
                        .Build();
                    return new DatabaseBackupService(config, new FakeWebHostEnv(tempRoot!));
                });

                // Replace EF context with file-based SQLite for backup tests
                var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<TrackerDbContext>));
                if (descriptor is not null) services.Remove(descriptor);

                services.AddDbContext<TrackerDbContext>(opts => opts.UseSqlite($"Data Source={dbPath}"));

                var sp = services.BuildServiceProvider();
                using var scope = sp.CreateScope();
                var dbCtx = scope.ServiceProvider.GetRequiredService<TrackerDbContext>();
                dbCtx.Database.EnsureCreated();
            });
        });

        _client = _factory.CreateClient();
    }

    public async Task DisposeAsync()
    {
        _client?.Dispose();
        if (_factory is not null) await _factory.DisposeAsync();
        SqliteConnection.ClearAllPools();
        TryDeleteDirectory(_tempRoot);
    }

    // -------------------------
    // POST /api/backup/export
    // -------------------------

    [Fact]
    public async Task Export_Should_Return_File_With_Db_Extension()
    {
        var response = await _client!.PostAsync("/api/backup/export", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/octet-stream", response.Content.Headers.ContentType?.MediaType);

        var disposition = response.Content.Headers.ContentDisposition;
        Assert.NotNull(disposition);
        var fileName = disposition!.FileNameStar ?? disposition.FileName?.Trim('"') ?? string.Empty;
        Assert.EndsWith(".db", fileName);
        Assert.StartsWith("timetracker-backup-", fileName);
    }

    [Fact]
    public async Task Export_Should_Return_Non_Empty_Content()
    {
        var response = await _client!.PostAsync("/api/backup/export", null);

        response.EnsureSuccessStatusCode();
        var bytes = await response.Content.ReadAsByteArrayAsync();
        Assert.NotEmpty(bytes);
    }

    // -------------------------
    // POST /api/backup/restore
    // -------------------------

    [Fact]
    public async Task Restore_Should_Return_ErrorCode_When_No_File_Provided()
    {
        // Send a multipart form without a "file" field so IFormFile? binds to null
        using var form = new MultipartFormDataContent();
        var emptyField = new StringContent(string.Empty);
        form.Add(emptyField, "other");
        var response = await _client!.PostAsync("/api/backup/restore", form);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ApiErrorResponse>();
        Assert.NotNull(problem);
        Assert.Equal(ApiErrorCodes.BackupFileMissing, problem!.Code);
    }

    [Fact]
    public async Task Restore_Should_Return_ErrorCode_When_File_Has_Wrong_Extension()
    {
        using var form = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent([0x53, 0x51, 0x4C, 0x69, 0x74, 0x65]);
        fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/octet-stream");
        form.Add(fileContent, "file", "backup.txt");

        var response = await _client!.PostAsync("/api/backup/restore", form);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ApiErrorResponse>();
        Assert.NotNull(problem);
        Assert.Equal(ApiErrorCodes.BackupFileInvalid, problem!.Code);
    }

    [Fact]
    public async Task Restore_Should_Return_ErrorCode_When_File_Is_Not_Valid_Sqlite()
    {
        using var form = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent([0x00, 0x01, 0x02, 0x03]);
        fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/octet-stream");
        form.Add(fileContent, "file", "notasqlite.db");

        var response = await _client!.PostAsync("/api/backup/restore", form);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ApiErrorResponse>();
        Assert.NotNull(problem);
        Assert.Equal(ApiErrorCodes.BackupFileInvalid, problem!.Code);
    }

    [Fact]
    public async Task Restore_Should_Return_Safety_Backup_Filename_On_Success()
    {
        var validDbPath = Path.Combine(_tempRoot!, $"valid-restore-{Guid.NewGuid():N}.db");
        try
        {
            var opts = new DbContextOptionsBuilder<TrackerDbContext>()
                .UseSqlite($"Data Source={validDbPath}")
                .Options;
            await using (var db = new TrackerDbContext(opts))
            {
                await db.Database.EnsureCreatedAsync();
                db.Tickets.Add(new Ticket { Type = TicketType.DEV, ExternalKey = "RESTORE-OK", Label = "Restore ticket" });
                await db.SaveChangesAsync();
            }
            SqliteConnection.ClearAllPools();

            var fileBytes = await File.ReadAllBytesAsync(validDbPath);
            using var form = new MultipartFormDataContent();
            var fileContent = new ByteArrayContent(fileBytes);
            fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/octet-stream");
            form.Add(fileContent, "file", "restore.db");

            var response = await _client!.PostAsync("/api/backup/restore", form);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<RestoreResponseDto>();
            Assert.NotNull(body);
            Assert.StartsWith("pre-restore-", body!.SafetyBackupFileName);
        }
        finally
        {
            TryDeleteFile(validDbPath);
        }
    }

    private static void TryDeleteDirectory(string? path)
    {
        if (string.IsNullOrWhiteSpace(path) || !Directory.Exists(path)) return;
        for (var i = 0; i < 5; i++)
        {
            try { Directory.Delete(path, recursive: true); return; }
            catch (IOException) when (i < 4) { Thread.Sleep(100); }
            catch (UnauthorizedAccessException) when (i < 4) { Thread.Sleep(100); }
        }
    }

    private static void TryDeleteFile(string? path)
    {
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path)) return;
        try { File.Delete(path); } catch { /* best effort */ }
    }

    private sealed record RestoreResponseDto(string SafetyBackupFileName);
}
