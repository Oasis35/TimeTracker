using Tracker.Api.Models;

namespace Tracker.Api.Data;

public static class DbSeeder
{
    public static void SeedDevelopmentData(TrackerDbContext db)
    {
        // 1) Crée des tickets si besoin (une seule fois)
        if (!db.Tickets.Any())
        {
            db.Tickets.AddRange(
                new Ticket { Type = "DEV", ExternalKey = "64205", Label = "Sécurité API" },
                new Ticket { Type = "DEV", ExternalKey = "64325", Label = "Correction export" },
                new Ticket { Type = "SUPPORT", ExternalKey = "INC-101", Label = "Incident prod mineur" }
            );
            db.SaveChanges();
        }

        // 2) Seed des time entries sur le mois courant (si vide sur ce mois)
        var today = DateOnly.FromDateTime(DateTime.Today);
        var start = new DateOnly(today.Year, today.Month, 1);
        var end = start.AddMonths(1);

        var hasEntriesThisMonth = db.TimeEntries.Any(e => e.Date >= start && e.Date < end);
        if (hasEntriesThisMonth)
            return;

        var tickets = db.Tickets
            .OrderBy(t => t.Id)
            .Take(3)
            .ToList();

        if (tickets.Count < 2)
            return;

        // Cas pratique : quelques jours du mois courant
        var d1 = start.AddDays(1);
        var d2 = start.AddDays(2);
        var d3 = start.AddDays(3);

        db.TimeEntries.AddRange(
            // Jour 1 : 0.5 + 0.5 = 1
            new TimeEntry { TicketId = tickets[0].Id, Date = d1, Quantity = 0.5m, Comment = "Dev" },
            new TimeEntry { TicketId = tickets[1].Id, Date = d1, Quantity = 0.5m, Comment = "Bugfix" },

            // Jour 2 : 0.25 + 0.75 = 1
            new TimeEntry { TicketId = tickets[0].Id, Date = d2, Quantity = 0.25m, Comment = "Revue" },
            new TimeEntry { TicketId = tickets[2].Id, Date = d2, Quantity = 0.75m, Comment = "Support" },

            // Jour 3 : 1 sur un ticket
            new TimeEntry { TicketId = tickets[1].Id, Date = d3, Quantity = 1.0m, Comment = "Implémentation" }
        );

        db.SaveChanges();
    }
}
