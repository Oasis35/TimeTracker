using System.Data.Common;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Tracker.Api.Data;

namespace Tracker.Api.Tests.Testing;

public static class DbTestHelper
{
    public static (TrackerDbContext Db, DbConnection Conn) CreateSqliteInMemoryDb()
    {
        var conn = new SqliteConnection("Data Source=:memory:");
        conn.Open();

        var options = new DbContextOptionsBuilder<TrackerDbContext>()
            .UseSqlite(conn)
            .EnableSensitiveDataLogging()
            .Options;

        var db = new TrackerDbContext(options);
        db.Database.EnsureCreated();

        return (db, conn);
    }
}