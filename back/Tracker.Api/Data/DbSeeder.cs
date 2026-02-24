using Tracker.Api.Models;
using Tracker.Api.Options;

namespace Tracker.Api.Data;

public static class DbSeeder
{
    private const string SeedMarkerComment = "__DEV_SEED__";

    public static void SeedDevelopmentData(TrackerDbContext db, TimeTrackingOptions opts)
    {
        if (opts.HoursPerDay <= 0)
            return;

        var minutesPerDay = opts.HoursPerDay * 60;

        // On conserve le mode quart de journée
        if (minutesPerDay % 4 != 0)
            return;

        var quarter = minutesPerDay / 4;
        var half = minutesPerDay / 2;
        var threeQuarter = minutesPerDay - quarter;

        // 1️⃣ Tickets seed (idempotent par ExternalKey)
        var requiredTickets = new[]
        {
            new Ticket { Type = "DEV", ExternalKey = "64205", Label = "Sécurité API" },
            new Ticket { Type = "DEV", ExternalKey = "64325", Label = "Correction export" },
            new Ticket { Type = "SUPPORT", ExternalKey = "INC-101", Label = "Incident prod mineur" }
        };

        foreach (var ticket in requiredTickets)
        {
            var exists = db.Tickets.Any(t =>
                t.Type == ticket.Type &&
                t.ExternalKey == ticket.ExternalKey);

            if (!exists)
                db.Tickets.Add(ticket);
        }

        db.SaveChanges(); // nécessaire pour récupérer les Id

        // 2️⃣ Seed month idempotent via marqueur
        var today = DateOnly.FromDateTime(DateTime.Today);
        var start = new DateOnly(today.Year, today.Month, 1);
        var end = start.AddMonths(1);

        var alreadySeeded = db.TimeEntries.Any(e =>
            e.Date >= start &&
            e.Date < end &&
            e.Comment == SeedMarkerComment);

        if (alreadySeeded)
            return;

        var tickets = db.Tickets
            .Where(t =>
                t.ExternalKey == "64205" ||
                t.ExternalKey == "64325" ||
                t.ExternalKey == "INC-101")
            .OrderBy(t => t.Id)
            .ToList();

        if (tickets.Count < 3)
            return;

        var d1 = start.AddDays(1);
        var d2 = start.AddDays(2);
        var d3 = start.AddDays(3);

        db.TimeEntries.AddRange(
            // Jour 1 : 0.5 + 0.5 = 1
            new TimeEntry { TicketId = tickets[0].Id, Date = d1, QuantityMinutes = half, Comment = SeedMarkerComment },
            new TimeEntry { TicketId = tickets[1].Id, Date = d1, QuantityMinutes = half, Comment = SeedMarkerComment },

            // Jour 2 : 0.25 + 0.75 = 1
            new TimeEntry { TicketId = tickets[0].Id, Date = d2, QuantityMinutes = quarter, Comment = SeedMarkerComment },
            new TimeEntry { TicketId = tickets[2].Id, Date = d2, QuantityMinutes = threeQuarter, Comment = SeedMarkerComment },

            // Jour 3 : 1 jour
            new TimeEntry { TicketId = tickets[1].Id, Date = d3, QuantityMinutes = minutesPerDay, Comment = SeedMarkerComment }
        );

        db.SaveChanges();
    }
}