using Tracker.Api.Models;
using Tracker.Api.Options;

namespace Tracker.Api.Data;

public static class DbSeeder
{
    private const string SeedMarkerComment = "__DEV_SEED_V2__";

    public static void SeedDevelopmentData(TrackerDbContext db, TimeTrackingOptions opts)
    {
        if (opts.HoursPerDay <= 0)
            return;

        var minutesPerDay = opts.HoursPerDay * 60;
        if (minutesPerDay % 4 != 0)
            return;

        var today = DateOnly.FromDateTime(DateTime.Today);
        var seedYear = today.Year - 1;

        // 1) Tickets DEV + CONGES (idempotent par Type + ExternalKey)
        var requiredTickets = new List<Ticket>
        {
            new() { Type = "DEV", ExternalKey = "65010", Label = "Refonte auth API" },
            new() { Type = "DEV", ExternalKey = "65011", Label = "Optimisation dashboard" },
            new() { Type = "DEV", ExternalKey = "65012", Label = "Corrections exports CSV" },
            new() { Type = "DEV", ExternalKey = "65013", Label = "Migration .NET 9" },
            new() { Type = "DEV", ExternalKey = "65014", Label = "Amélioration recherche tickets" },
            new() { Type = "DEV", ExternalKey = "65015", Label = "Nettoyage jobs batch" },
            new() { Type = "DEV", ExternalKey = "65016", Label = "Amélioration performance SQL" },
            new() { Type = "DEV", ExternalKey = "65017", Label = "Correction calculs congés" },
            new() { Type = "DEV", ExternalKey = "65018", Label = "UI liste des tickets" },
            new() { Type = "DEV", ExternalKey = "65019", Label = "Stabilisation CI/CD" },
            new() { Type = "DEV", ExternalKey = "65020", Label = "Refactor API timesheet" },
            new() { Type = "DEV", ExternalKey = "65021", Label = "Audit sécurité dépendances" },
            new() { Type = "DEV", ExternalKey = "65022", Label = "Ajout endpoint statistiques" },
            new() { Type = "DEV", ExternalKey = "65023", Label = "Mise à niveau Angular" },
            new() { Type = "DEV", ExternalKey = "65024", Label = "Tests de non-régression" },

            new() { Type = "CONGES", ExternalKey = "CP-HIVER", Label = "Congés hiver" },
            new() { Type = "CONGES", ExternalKey = "CP-PRINTEMPS", Label = "Congés printemps" },
            new() { Type = "CONGES", ExternalKey = "CP-ETE", Label = "Congés été" },
            new() { Type = "CONGES", ExternalKey = "CP-TOUSSAINT", Label = "Congés Toussaint" },
            new() { Type = "CONGES", ExternalKey = "CP-NOEL", Label = "Congés fin d'année" },
            new() { Type = "CONGES", ExternalKey = "RTT-PONTS", Label = "RTT et ponts" }
        };

        foreach (var ticket in requiredTickets)
        {
            var exists = db.Tickets.Any(t =>
                t.Type == ticket.Type &&
                t.ExternalKey == ticket.ExternalKey);

            if (!exists)
                db.Tickets.Add(ticket);
        }

        db.SaveChanges();

        // 2) Seed idempotent : on ne rejoue pas si v2 déjà présent
        var alreadySeeded = db.TimeEntries.Any(e => e.Comment == SeedMarkerComment);

        if (alreadySeeded)
            return;

        var ticketsByKey = db.Tickets
            .Where(t => t.ExternalKey != null)
            .ToList();

        int GetTicketId(string externalKey)
            => ticketsByKey.First(t => t.ExternalKey == externalKey).Id;

        var devKeys = requiredTickets
            .Where(t => t.Type == "DEV")
            .Select(t => t.ExternalKey!)
            .ToList();

        if (devKeys.Count == 0)
            return;

        var periodEntries = new List<TimeEntry>();
        int devIndex = 0;

        void AddDevDay(DateOnly date)
        {
            if (date >= today || date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
                return;

            var key = devKeys[devIndex % devKeys.Count];
            devIndex++;
            periodEntries.Add(new TimeEntry
            {
                TicketId = GetTicketId(key),
                Date = date,
                QuantityMinutes = minutesPerDay,
                Comment = SeedMarkerComment
            });
        }

        void AddCongesPeriod(string ticketKey, DateOnly start, DateOnly endInclusive)
        {
            var ticketId = GetTicketId(ticketKey);
            for (var day = start; day <= endInclusive; day = day.AddDays(1))
            {
                if (day >= today || day.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
                    continue;

                periodEntries.Add(new TimeEntry
                {
                    TicketId = ticketId,
                    Date = day,
                    QuantityMinutes = minutesPerDay,
                    Comment = SeedMarkerComment
                });
            }
        }

        // Remplit l'année passée en DEV sur les jours ouvrés
        for (var month = 1; month <= 12; month++)
        {
            var from = new DateOnly(seedYear, month, 1);
            var to = from.AddMonths(1).AddDays(-1);
            for (var day = from; day <= to; day = day.AddDays(1))
            {
                AddDevDay(day);
            }
        }

        // Périodes de congés françaises (année passée), toutes dans le passé
        AddCongesPeriod("CP-HIVER", new DateOnly(seedYear, 2, 26), new DateOnly(seedYear, 3, 1));
        AddCongesPeriod("CP-PRINTEMPS", new DateOnly(seedYear, 4, 22), new DateOnly(seedYear, 4, 26));
        AddCongesPeriod("CP-ETE", new DateOnly(seedYear, 8, 5), new DateOnly(seedYear, 8, 23));
        AddCongesPeriod("CP-TOUSSAINT", new DateOnly(seedYear, 10, 28), new DateOnly(seedYear, 11, 1));
        AddCongesPeriod("CP-NOEL", new DateOnly(seedYear, 12, 23), new DateOnly(seedYear, 12, 31));
        AddCongesPeriod("RTT-PONTS", new DateOnly(seedYear, 5, 2), new DateOnly(seedYear, 5, 3));
        AddCongesPeriod("RTT-PONTS", new DateOnly(seedYear, 5, 10), new DateOnly(seedYear, 5, 10));

        // Remplace les saisies DEV des jours de congés par les saisies CONGES
        var congesDays = periodEntries
            .Where(e => e.TicketId == GetTicketId("CP-HIVER")
                     || e.TicketId == GetTicketId("CP-PRINTEMPS")
                     || e.TicketId == GetTicketId("CP-ETE")
                     || e.TicketId == GetTicketId("CP-TOUSSAINT")
                     || e.TicketId == GetTicketId("CP-NOEL")
                     || e.TicketId == GetTicketId("RTT-PONTS"))
            .Select(e => e.Date)
            .ToHashSet();

        periodEntries = periodEntries
            .Where(e => !devKeys.Select(GetTicketId).Contains(e.TicketId ?? -1) || !congesDays.Contains(e.Date))
            .ToList();

        // Sécurité idempotence sur index (TicketId, Date)
        var existingPairs = db.TimeEntries
            .Where(e => e.TicketId != null)
            .Select(e => new { e.TicketId, e.Date })
            .ToList()
            .Select(x => $"{x.TicketId}-{x.Date:yyyy-MM-dd}")
            .ToHashSet();

        var toInsert = periodEntries
            .Where(e => e.TicketId != null)
            .Where(e => !existingPairs.Contains($"{e.TicketId}-{e.Date:yyyy-MM-dd}"))
            .ToList();

        if (toInsert.Count == 0)
            return;

        db.TimeEntries.AddRange(toInsert);
        db.SaveChanges();
    }
}
