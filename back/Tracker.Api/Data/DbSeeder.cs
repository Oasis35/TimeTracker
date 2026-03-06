using Tracker.Api.Models;
using Tracker.Api.Options;

namespace Tracker.Api.Data;

public static class DbSeeder
{
    private const string SeedMarkerComment = "__DEV_SEED_V2__";
    private const string SingleLeaveExternalKey = "CP";

    public static void SeedDevelopmentData(TrackerDbContext db, TimeTrackingOptions opts)
    {
        if (opts.HoursPerDay <= 0)
            return;

        var minutesPerDay = opts.HoursPerDay * 60;
        if (minutesPerDay % 4 != 0)
            return;

        var seedStart = new DateOnly(2025, 1, 1);
        var seedEnd = new DateOnly(2026, 2, 28);

        // 1) Tickets DEV + un seul ticket CONGES (idempotent par Type + ExternalKey)
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
            new() { Type = "CONGES", ExternalKey = SingleLeaveExternalKey, Label = "Congés" }
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

        NormalizeSeededLeaveEntriesToSingleCpTicket(db);

        var ticketIdsByExternalKey = db.Tickets
            .Where(t => t.ExternalKey != null)
            .ToDictionary(t => t.ExternalKey!, t => t.Id, StringComparer.Ordinal);

        int GetTicketId(string externalKey) => ticketIdsByExternalKey[externalKey];

        var devKeys = requiredTickets
            .Where(t => t.Type == "DEV")
            .Select(t => t.ExternalKey!)
            .ToList();
        var devTicketIds = devKeys
            .Select(GetTicketId)
            .ToHashSet();

        var periodEntries = new List<TimeEntry>();
        int devIndex = 0;

        void AddDevDay(DateOnly date)
        {
            if (date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
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
                if (day.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
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

        // Remplit la période de seed en DEV sur les jours ouvrés.
        for (var day = seedStart; day <= seedEnd; day = day.AddDays(1))
        {
            AddDevDay(day);
        }

        // Périodes de congés seedées sur le ticket CP unique.
        AddCongesPeriod(SingleLeaveExternalKey, new DateOnly(2025, 2, 26), new DateOnly(2025, 3, 1));
        AddCongesPeriod(SingleLeaveExternalKey, new DateOnly(2025, 4, 22), new DateOnly(2025, 4, 26));
        AddCongesPeriod(SingleLeaveExternalKey, new DateOnly(2025, 5, 2), new DateOnly(2025, 5, 3));
        AddCongesPeriod(SingleLeaveExternalKey, new DateOnly(2025, 5, 10), new DateOnly(2025, 5, 10));
        AddCongesPeriod(SingleLeaveExternalKey, new DateOnly(2025, 8, 5), new DateOnly(2025, 8, 23));
        AddCongesPeriod(SingleLeaveExternalKey, new DateOnly(2025, 10, 28), new DateOnly(2025, 11, 1));
        AddCongesPeriod(SingleLeaveExternalKey, new DateOnly(2025, 12, 23), new DateOnly(2025, 12, 31));
        AddCongesPeriod(SingleLeaveExternalKey, new DateOnly(2026, 2, 23), new DateOnly(2026, 2, 27));

        // Remplace les saisies DEV des jours de congés par les saisies CONGES
        var singleLeaveTicketId = GetTicketId(SingleLeaveExternalKey);
        var congesDays = periodEntries
            .Where(e => e.TicketId == singleLeaveTicketId)
            .Select(e => e.Date)
            .ToHashSet();

        periodEntries = periodEntries
            .Where(e => e.TicketId is not int ticketId || !devTicketIds.Contains(ticketId) || !congesDays.Contains(e.Date))
            .ToList();

        // Sécurité idempotence sur index (TicketId, Date)
        var existingPairs = db.TimeEntries
            .Where(e => e.TicketId != null)
            .Select(e => new { e.TicketId, e.Date })
            .ToList()
            .Select(x => (TicketId: x.TicketId!.Value, x.Date))
            .ToHashSet();

        var toInsert = periodEntries
            .Where(e => e.TicketId is int ticketId && !existingPairs.Contains((ticketId, e.Date)))
            .ToList();

        if (toInsert.Count == 0)
            return;

        db.TimeEntries.AddRange(toInsert);
        db.SaveChanges();
    }

    private static void NormalizeSeededLeaveEntriesToSingleCpTicket(TrackerDbContext db)
    {
        var cpTicket = db.Tickets.FirstOrDefault(t => t.Type == "CONGES" && t.ExternalKey == SingleLeaveExternalKey);
        if (cpTicket is null)
            return;

        var leaveTickets = db.Tickets
            .Where(t => t.Type == "CONGES")
            .ToList();
        var leaveTicketsById = leaveTickets.ToDictionary(t => t.Id);

        var seededLeaveEntries = db.TimeEntries
            .Where(e => e.Comment == SeedMarkerComment && e.TicketId != null)
            .ToList();
        var seededLeaveEntryPairs = seededLeaveEntries
            .Where(e => e.TicketId is int ticketId && leaveTicketsById.ContainsKey(ticketId))
            .Select(e => new { Entry = e, Ticket = leaveTicketsById[e.TicketId!.Value] })
            .ToList();

        if (seededLeaveEntryPairs.Count > 0)
        {
            var cpDates = seededLeaveEntryPairs
                .Where(x => x.Ticket.Id == cpTicket.Id)
                .Select(x => x.Entry.Date)
                .ToHashSet();

            var toDelete = new List<TimeEntry>();
            foreach (var item in seededLeaveEntryPairs.Where(x => x.Ticket.Id != cpTicket.Id))
            {
                if (cpDates.Contains(item.Entry.Date))
                {
                    toDelete.Add(item.Entry);
                    continue;
                }

                item.Entry.TicketId = cpTicket.Id;
                cpDates.Add(item.Entry.Date);
            }

            if (toDelete.Count > 0)
                db.TimeEntries.RemoveRange(toDelete);

            db.SaveChanges();
        }

        var removableLegacyLeaveTickets = db.Tickets
            .Where(t => t.Type == "CONGES" && t.Id != cpTicket.Id)
            .Where(t => !db.TimeEntries.Any(e => e.TicketId == t.Id))
            .ToList();

        if (removableLegacyLeaveTickets.Count == 0)
            return;

        db.Tickets.RemoveRange(removableLegacyLeaveTickets);
        db.SaveChanges();
    }
}
