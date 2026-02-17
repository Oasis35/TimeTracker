using Tracker.Api.Models;

namespace Tracker.Api.Data;

public static class DbSeeder
{
    public static void SeedDevelopmentData(TrackerDbContext db)
    {
        // déjà seedé
        if (db.Tickets.Any())
            return;

        var t1 = new Ticket
        {
            Type = "DEV",
            ExternalKey = "64205",
            Label = "Sécurité API"
        };

        var t2 = new Ticket
        {
            Type = "DEV",
            ExternalKey = "64325",
            Label = "Correction export"
        };

        var t3 = new Ticket
        {
            Type = "ABSENCE",
            ExternalKey = null,
            Label = null
        };

        db.Tickets.AddRange(t1, t2, t3);
        db.SaveChanges();

        db.TimeEntries.AddRange(
            new TimeEntry
            {
                TicketId = t1.Id,
                Date = new DateOnly(2025, 5, 6),
                Quantity = 0.5m
            },
            new TimeEntry
            {
                TicketId = t2.Id,
                Date = new DateOnly(2025, 5, 6),
                Quantity = 0.5m
            },
            new TimeEntry
            {
                TicketId = t1.Id,
                Date = new DateOnly(2025, 5, 7),
                Quantity = 0.25m
            }
        );

        db.SaveChanges();
    }
}