using Tracker.Api.Data;
using Tracker.Api.Models;
using Tracker.Api.Options;
using Tracker.Api.Tests.Testing;
using Xunit;

namespace Tracker.Api.Tests;

public sealed class DbSeederTests
{
    [Fact]
    public async Task SeedDevelopmentData_Should_Create_Single_Conges_Ticket_With_CP_Key()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        DbSeeder.SeedDevelopmentData(db, new TimeTrackingOptions { HoursPerDay = 8 });

        var congesTickets = db.Tickets
            .Where(t => t.Type == "CONGES")
            .ToList();

        Assert.Single(congesTickets);
        Assert.Equal("CP", congesTickets[0].ExternalKey);
    }

    [Fact]
    public async Task SeedDevelopmentData_Should_Migrate_Legacy_Seeded_Leave_Entries_To_CP()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var cp = new Ticket { Type = "CONGES", ExternalKey = "CP", Label = "Conges" };
        var legacy = new Ticket { Type = "CONGES", ExternalKey = "CP-ETE", Label = "Legacy leave" };
        db.Tickets.AddRange(cp, legacy);
        await db.SaveChangesAsync();

        db.TimeEntries.AddRange(
            new TimeEntry
            {
                TicketId = cp.Id,
                Date = new DateOnly(2025, 8, 5),
                QuantityMinutes = 480,
                Comment = "__DEV_SEED_V2__"
            },
            new TimeEntry
            {
                TicketId = legacy.Id,
                Date = new DateOnly(2025, 8, 5),
                QuantityMinutes = 480,
                Comment = "__DEV_SEED_V2__"
            },
            new TimeEntry
            {
                TicketId = legacy.Id,
                Date = new DateOnly(2025, 8, 6),
                QuantityMinutes = 480,
                Comment = "__DEV_SEED_V2__"
            }
        );
        await db.SaveChangesAsync();

        DbSeeder.SeedDevelopmentData(db, new TimeTrackingOptions { HoursPerDay = 8 });

        var cpTicket = db.Tickets.Single(t => t.Type == "CONGES" && t.ExternalKey == "CP");
        var seededLeaveEntries = db.TimeEntries
            .Where(e => e.Comment == "__DEV_SEED_V2__" && e.TicketId != null)
            .Join(
                db.Tickets.Where(t => t.Type == "CONGES"),
                e => e.TicketId!.Value,
                t => t.Id,
                (entry, _) => entry)
            .ToList();

        Assert.All(seededLeaveEntries, entry => Assert.Equal(cpTicket.Id, entry.TicketId));
        Assert.DoesNotContain(db.Tickets, t => t.Type == "CONGES" && t.ExternalKey == "CP-ETE");
    }
}
