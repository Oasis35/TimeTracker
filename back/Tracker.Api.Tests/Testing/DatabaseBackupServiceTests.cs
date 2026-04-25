using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Tracker.Api.Data;
using Tracker.Api.Models;
using Tracker.Api.Services;
using Tracker.Api.Tests.Testing;
using Xunit;

namespace Tracker.Api.Tests;

public sealed class DatabaseBackupServiceTests
{
    [Fact]
    public async Task ExportAsync_Should_Return_Backup_Of_Current_Database()
    {
        var root = CreateTempDirectory();
        try
        {
            var dbPath = Path.Combine(root, "tracker.db");
            await CreateDatabaseAsync(dbPath, "EXP-1");

            var service = CreateService(root, dbPath);
            var export = await service.ExportAsync();

            Assert.StartsWith("timetracker-backup-", export.FileName);
            Assert.NotEmpty(export.Content);

            var restoredPath = Path.Combine(root, "export-check.db");
            await File.WriteAllBytesAsync(restoredPath, export.Content);

            await using var checkDb = await OpenDbAsync(restoredPath);
            var ticketCount = await checkDb.Tickets.CountAsync();
            Assert.Equal(1, ticketCount);
        }
        finally
        {
            TryDeleteDirectory(root);
        }
    }

    [Fact]
    public async Task RestoreAsync_Should_Create_Safety_Backup_And_Replace_Current_Database()
    {
        var root = CreateTempDirectory();
        try
        {
            var activeDbPath = Path.Combine(root, "tracker.db");
            var incomingDbPath = Path.Combine(root, "incoming.db");

            await CreateDatabaseAsync(activeDbPath, "ACTIVE-1");
            await CreateDatabaseAsync(incomingDbPath, "RESTORE-1");

            var service = CreateService(root, activeDbPath);

            await using (var stream = File.OpenRead(incomingDbPath))
            {
                var result = await service.RestoreAsync(stream);
                Assert.StartsWith("pre-restore-", result.SafetyBackupFileName);

                var safetyPath = Path.Combine(root, "backups", result.SafetyBackupFileName);
                Assert.True(File.Exists(safetyPath));

                await using var safetyDb = await OpenDbAsync(safetyPath);
                Assert.Contains(await safetyDb.Tickets.Select(t => t.ExternalKey).ToListAsync(), key => key == "ACTIVE-1");
            }

            await using var activeDb = await OpenDbAsync(activeDbPath);
            var activeKeys = await activeDb.Tickets.Select(t => t.ExternalKey).ToListAsync();
            Assert.Contains("RESTORE-1", activeKeys);
            Assert.DoesNotContain("ACTIVE-1", activeKeys);
        }
        finally
        {
            TryDeleteDirectory(root);
        }
    }

    private static DatabaseBackupService CreateService(string contentRoot, string dbPath)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:Main"] = $"Data Source={dbPath}"
            })
            .Build();

        return new DatabaseBackupService(configuration, new FakeWebHostEnv(contentRoot));
    }

    private static async Task CreateDatabaseAsync(string dbPath, string externalKey)
    {
        var options = new DbContextOptionsBuilder<TrackerDbContext>()
            .UseSqlite($"Data Source={dbPath}")
            .Options;

        await using var db = new TrackerDbContext(options);
        await db.Database.EnsureCreatedAsync();

        db.Tickets.Add(new Ticket
        {
            Type = TicketType.DEV,
            ExternalKey = externalKey,
            Label = externalKey
        });

        await db.SaveChangesAsync();
        SqliteConnection.ClearAllPools();
    }

    private static async Task<TrackerDbContext> OpenDbAsync(string dbPath)
    {
        var options = new DbContextOptionsBuilder<TrackerDbContext>()
            .UseSqlite($"Data Source={dbPath}")
            .Options;
        var db = new TrackerDbContext(options);
        await db.Database.EnsureCreatedAsync();
        return db;
    }

    private static string CreateTempDirectory()
    {
        var path = Path.Combine(Path.GetTempPath(), $"timetracker-backup-tests-{Guid.NewGuid():N}");
        Directory.CreateDirectory(path);
        return path;
    }

    private static void TryDeleteDirectory(string path)
    {
        if (!Directory.Exists(path))
            return;

        for (var attempt = 0; attempt < 5; attempt++)
        {
            try
            {
                Directory.Delete(path, recursive: true);
                return;
            }
            catch (IOException)
            {
                if (attempt == 4) return;
                Thread.Sleep(100);
            }
            catch (UnauthorizedAccessException)
            {
                if (attempt == 4) return;
                Thread.Sleep(100);
            }
        }
    }

}
