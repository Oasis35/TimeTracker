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

    // ——————————————————————————————————————
    // IsValidBackupAsync — table validation
    // ——————————————————————————————————————

    [Fact]
    public async Task RestoreAsync_Should_Throw_When_Required_Table_Is_Missing()
    {
        var root = CreateTempDirectory();
        try
        {
            var activeDbPath = Path.Combine(root, "tracker.db");
            await CreateDatabaseAsync(activeDbPath, "ACTIVE-1");

            // Create a SQLite file that is missing the TimeEntries table
            var incompleteDbPath = Path.Combine(root, "incomplete.db");
            await CreateDatabaseWithoutTableAsync(incompleteDbPath, "TimeEntries");

            var service = CreateService(root, activeDbPath);

            await using var stream = File.OpenRead(incompleteDbPath);
            await Assert.ThrowsAsync<InvalidBackupException>(() => service.RestoreAsync(stream));
        }
        finally
        {
            TryDeleteDirectory(root);
        }
    }

    [Fact]
    public async Task RestoreAsync_Should_Throw_When_Required_Column_Is_Missing()
    {
        var root = CreateTempDirectory();
        try
        {
            var activeDbPath = Path.Combine(root, "tracker.db");
            await CreateDatabaseAsync(activeDbPath, "ACTIVE-1");

            // Create a SQLite file where TimeEntries is missing the TicketId column
            var incompleteDbPath = Path.Combine(root, "incomplete.db");
            await CreateDatabaseWithMissingColumnAsync(incompleteDbPath);

            var service = CreateService(root, activeDbPath);

            await using var stream = File.OpenRead(incompleteDbPath);
            await Assert.ThrowsAsync<InvalidBackupException>(() => service.RestoreAsync(stream));
        }
        finally
        {
            TryDeleteDirectory(root);
        }
    }

    [Fact]
    public async Task RestoreAsync_Should_Accept_Schema_With_Extra_Columns()
    {
        var root = CreateTempDirectory();
        try
        {
            var activeDbPath = Path.Combine(root, "tracker.db");
            await CreateDatabaseAsync(activeDbPath, "ACTIVE-1");

            // Create a valid database with an extra column — should still be accepted
            var extraDbPath = Path.Combine(root, "extra.db");
            await CreateDatabaseWithExtraColumnAsync(extraDbPath, "EXTRA-1");

            var service = CreateService(root, activeDbPath);

            await using var stream = File.OpenRead(extraDbPath);
            var result = await service.RestoreAsync(stream);

            Assert.StartsWith("pre-restore-", result.SafetyBackupFileName);
        }
        finally
        {
            SqliteConnection.ClearAllPools();
            TryDeleteDirectory(root);
        }
    }

    [Fact]
    public async Task RestoreAsync_Should_Accept_Column_Names_Case_Insensitively()
    {
        var root = CreateTempDirectory();
        try
        {
            var activeDbPath = Path.Combine(root, "tracker.db");
            await CreateDatabaseAsync(activeDbPath, "ACTIVE-1");

            // Create a database whose column names use different casing (e.g. "ticketid" instead of "TicketId")
            var caseDbPath = Path.Combine(root, "case.db");
            await CreateDatabaseWithLowercaseColumnsAsync(caseDbPath, "CASE-1");

            var service = CreateService(root, activeDbPath);

            await using var stream = File.OpenRead(caseDbPath);
            var result = await service.RestoreAsync(stream);

            Assert.StartsWith("pre-restore-", result.SafetyBackupFileName);
        }
        finally
        {
            SqliteConnection.ClearAllPools();
            TryDeleteDirectory(root);
        }
    }

    // ——————————————————————————————————————
    // Constructor validation
    // ——————————————————————————————————————

    [Fact]
    public void Constructor_Should_Throw_When_Connection_String_Is_Memory()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:Main"] = "Data Source=:memory:"
            })
            .Build();

        Assert.Throws<InvalidOperationException>(
            () => new DatabaseBackupService(configuration, new FakeWebHostEnv(Path.GetTempPath())));
    }

    [Fact]
    public void Constructor_Should_Throw_When_Connection_String_Is_Missing()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        Assert.Throws<InvalidOperationException>(
            () => new DatabaseBackupService(configuration, new FakeWebHostEnv(Path.GetTempPath())));
    }

    // ——————————————————————————————————————
    // Schema creation helpers
    // ——————————————————————————————————————

    private static async Task CreateDatabaseWithoutTableAsync(string dbPath, string missingTable)
    {
        await using var connection = new SqliteConnection($"Data Source={dbPath}");
        await connection.OpenAsync();

        // Create all required tables except the one to omit
        var allTables = new Dictionary<string, string>
        {
            ["Tickets"] = "CREATE TABLE Tickets (Id INTEGER PRIMARY KEY, Type TEXT NOT NULL, ExternalKey TEXT NOT NULL, Label TEXT NOT NULL);",
            ["TimeEntries"] = "CREATE TABLE TimeEntries (Id INTEGER PRIMARY KEY, TicketId INTEGER NOT NULL, Date TEXT NOT NULL, QuantityMinutes INTEGER NOT NULL, IsSeed INTEGER NOT NULL);",
            ["AppSettings"] = "CREATE TABLE AppSettings (Key TEXT PRIMARY KEY, Value TEXT NOT NULL);"
        };

        foreach (var (table, ddl) in allTables)
        {
            if (table.Equals(missingTable, StringComparison.OrdinalIgnoreCase))
                continue;
            await using var cmd = connection.CreateCommand();
            cmd.CommandText = ddl;
            await cmd.ExecuteNonQueryAsync();
        }

        SqliteConnection.ClearAllPools();
    }

    private static async Task CreateDatabaseWithMissingColumnAsync(string dbPath)
    {
        await using var connection = new SqliteConnection($"Data Source={dbPath}");
        await connection.OpenAsync();

        // TimeEntries is missing the TicketId column
        var ddls = new[]
        {
            "CREATE TABLE Tickets (Id INTEGER PRIMARY KEY, Type TEXT NOT NULL, ExternalKey TEXT NOT NULL, Label TEXT NOT NULL);",
            "CREATE TABLE TimeEntries (Id INTEGER PRIMARY KEY, Date TEXT NOT NULL, QuantityMinutes INTEGER NOT NULL, IsSeed INTEGER NOT NULL);",
            "CREATE TABLE AppSettings (Key TEXT PRIMARY KEY, Value TEXT NOT NULL);"
        };

        foreach (var ddl in ddls)
        {
            await using var cmd = connection.CreateCommand();
            cmd.CommandText = ddl;
            await cmd.ExecuteNonQueryAsync();
        }

        SqliteConnection.ClearAllPools();
    }

    private static async Task CreateDatabaseWithExtraColumnAsync(string dbPath, string externalKey)
    {
        await using var connection = new SqliteConnection($"Data Source={dbPath}");
        await connection.OpenAsync();

        var ddls = new[]
        {
            "CREATE TABLE Tickets (Id INTEGER PRIMARY KEY, Type TEXT NOT NULL, ExternalKey TEXT NOT NULL, Label TEXT NOT NULL, ExtraColumn TEXT);",
            "CREATE TABLE TimeEntries (Id INTEGER PRIMARY KEY, TicketId INTEGER NOT NULL, Date TEXT NOT NULL, QuantityMinutes INTEGER NOT NULL, IsSeed INTEGER NOT NULL);",
            "CREATE TABLE AppSettings (Key TEXT PRIMARY KEY, Value TEXT NOT NULL);"
        };

        foreach (var ddl in ddls)
        {
            await using var cmd = connection.CreateCommand();
            cmd.CommandText = ddl;
            await cmd.ExecuteNonQueryAsync();
        }

        await using var insert = connection.CreateCommand();
        insert.CommandText = $"INSERT INTO Tickets (Type, ExternalKey, Label) VALUES ('DEV', '{externalKey}', '{externalKey}');";
        await insert.ExecuteNonQueryAsync();

        SqliteConnection.ClearAllPools();
    }

    private static async Task CreateDatabaseWithLowercaseColumnsAsync(string dbPath, string externalKey)
    {
        await using var connection = new SqliteConnection($"Data Source={dbPath}");
        await connection.OpenAsync();

        // Column names in lowercase — RequiredColumns uses OrdinalIgnoreCase so these should be accepted
        var ddls = new[]
        {
            "CREATE TABLE Tickets (id INTEGER PRIMARY KEY, type TEXT NOT NULL, externalkey TEXT NOT NULL, label TEXT NOT NULL);",
            "CREATE TABLE TimeEntries (id INTEGER PRIMARY KEY, ticketid INTEGER NOT NULL, date TEXT NOT NULL, quantityminutes INTEGER NOT NULL, isseed INTEGER NOT NULL);",
            "CREATE TABLE AppSettings (key TEXT PRIMARY KEY, value TEXT NOT NULL);"
        };

        foreach (var ddl in ddls)
        {
            await using var cmd = connection.CreateCommand();
            cmd.CommandText = ddl;
            await cmd.ExecuteNonQueryAsync();
        }

        await using var insert = connection.CreateCommand();
        insert.CommandText = $"INSERT INTO Tickets (type, externalkey, label) VALUES ('DEV', '{externalKey}', '{externalKey}');";
        await insert.ExecuteNonQueryAsync();

        SqliteConnection.ClearAllPools();
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
