using Tracker.Api.Models;
using Tracker.Api.Options;

namespace Tracker.Api.Data;

public static class DbSeeder
{
    private const string SingleLeaveExternalKey = "CP";

    public static void SeedDevelopmentData(TrackerDbContext db, TimeTrackingOptions opts)
    {
        var minutesPerDay = opts.MinutesPerDay;
        if (minutesPerDay <= 0 || minutesPerDay % 4 != 0)
            return;

        var today = DateOnly.FromDateTime(DateTime.Today);
        var firstDayCurrentMonth = new DateOnly(today.Year, today.Month, 1);
        var lastDayCurrentMonth = firstDayCurrentMonth.AddMonths(1).AddDays(-1);
        var seedStart = firstDayCurrentMonth.AddMonths(-11);
        var seedEnd = lastDayCurrentMonth;

        // DEV tickets + one ABSENT ticket (idempotent by Type + ExternalKey)
        var requiredTickets = new List<Ticket>
        {
            new() { Type = TicketType.DEV, ExternalKey = "65010", Label = "Refonte auth API" },
            new() { Type = TicketType.DEV, ExternalKey = "65011", Label = "Optimisation dashboard" },
            new() { Type = TicketType.DEV, ExternalKey = "65012", Label = "Corrections exports CSV" },
            new() { Type = TicketType.DEV, ExternalKey = "65013", Label = "Migration .NET 9" },
            new() { Type = TicketType.DEV, ExternalKey = "65014", Label = "Amélioration recherche tickets" },
            new() { Type = TicketType.DEV, ExternalKey = "65015", Label = "Nettoyage jobs batch" },
            new() { Type = TicketType.DEV, ExternalKey = "65016", Label = "Amélioration performance SQL" },
            new() { Type = TicketType.DEV, ExternalKey = "65017", Label = "Correction calculs absences" },
            new() { Type = TicketType.DEV, ExternalKey = "65018", Label = "UI liste des tickets" },
            new() { Type = TicketType.DEV, ExternalKey = "65019", Label = "Stabilisation CI/CD" },
            new() { Type = TicketType.DEV, ExternalKey = "65020", Label = "Refactor API timesheet" },
            new() { Type = TicketType.DEV, ExternalKey = "65021", Label = "Audit sécurité dépendances" },
            new() { Type = TicketType.DEV, ExternalKey = "65022", Label = "Ajout endpoint statistiques" },
            new() { Type = TicketType.DEV, ExternalKey = "65023", Label = "Mise à niveau Angular" },
            new() { Type = TicketType.DEV, ExternalKey = "65024", Label = "Tests de non-régression" },
            new() { Type = TicketType.ABSENT, ExternalKey = SingleLeaveExternalKey, Label = "Congés" }
        };

        var existingKeys = db.Tickets
            .Select(t => new { t.Type, t.ExternalKey })
            .ToHashSet();

        foreach (var ticket in requiredTickets)
        {
            if (!existingKeys.Contains(new { ticket.Type, ticket.ExternalKey }))
                db.Tickets.Add(ticket);
        }

        db.SaveChanges();

        NormalizeSeededLeaveEntriesToSingleCpTicket(db);

        var ticketIdsByExternalKey = db.Tickets
            .Where(t => t.ExternalKey != null)
            .ToDictionary(t => t.ExternalKey!, t => t.Id, StringComparer.Ordinal);

        int GetTicketId(string externalKey) => ticketIdsByExternalKey[externalKey];

        var devKeys = requiredTickets
            .Where(t => t.Type == TicketType.DEV)
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
                IsSeed = true
            });
        }

        void AddAbsentPeriod(DateOnly start, DateOnly endInclusive)
        {
            var effectiveStart = start < seedStart ? seedStart : start;
            var effectiveEnd = endInclusive > seedEnd ? seedEnd : endInclusive;
            if (effectiveStart > effectiveEnd)
                return;

            var ticketId = GetTicketId(SingleLeaveExternalKey);
            for (var day = effectiveStart; day <= effectiveEnd; day = day.AddDays(1))
            {
                if (day.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
                    continue;

                periodEntries.Add(new TimeEntry
                {
                    TicketId = ticketId,
                    Date = day,
                    QuantityMinutes = minutesPerDay,
                    IsSeed = true
                });
            }
        }

        void AddAbsentPeriodsForYear(int year)
        {
            AddAbsentPeriod(new DateOnly(year, 2, 24), new DateOnly(year, 2, 28));
            AddAbsentPeriod(new DateOnly(year, 4, 22), new DateOnly(year, 4, 26));
            AddAbsentPeriod(new DateOnly(year, 5, 2), new DateOnly(year, 5, 3));
            AddAbsentPeriod(new DateOnly(year, 5, 10), new DateOnly(year, 5, 10));
            AddAbsentPeriod(new DateOnly(year, 8, 5), new DateOnly(year, 8, 23));
            AddAbsentPeriod(new DateOnly(year, 10, 28), new DateOnly(year, 11, 1));
            AddAbsentPeriod(new DateOnly(year, 12, 23), new DateOnly(year, 12, 31));
        }

        // Fill the seed period with DEV entries on weekdays.
        for (var day = seedStart; day <= seedEnd; day = day.AddDays(1))
            AddDevDay(day);

        // Seed ABSENT periods on the unique CP ticket, clamped to current seed window.
        for (var year = seedStart.Year; year <= seedEnd.Year; year++)
            AddAbsentPeriodsForYear(year);

        // Replace DEV entries on absence days by ABSENT entries.
        var singleLeaveTicketId = GetTicketId(SingleLeaveExternalKey);
        var absentDays = periodEntries
            .Where(e => e.TicketId == singleLeaveTicketId)
            .Select(e => e.Date)
            .ToHashSet();

        periodEntries = periodEntries
            .Where(e => e.TicketId is not int ticketId || !devTicketIds.Contains(ticketId) || !absentDays.Contains(e.Date))
            .ToList();

        // Idempotency safety on unique index (TicketId, Date).
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
        var cpTicket = db.Tickets.FirstOrDefault(t =>
            t.Type == TicketType.ABSENT &&
            t.ExternalKey == SingleLeaveExternalKey);
        if (cpTicket is null)
            return;

        var leaveTicketIds = db.Tickets
            .Where(t => t.Type == TicketType.ABSENT)
            .Select(t => t.Id)
            .ToHashSet();

        var seededLeaveEntries = db.TimeEntries
            .Where(e => e.IsSeed && e.TicketId != null && leaveTicketIds.Contains(e.TicketId!.Value))
            .ToList();

        if (seededLeaveEntries.Count > 0)
        {
            var cpDates = seededLeaveEntries
                .Where(e => e.TicketId == cpTicket.Id)
                .Select(e => e.Date)
                .ToHashSet();

            var toDelete = new List<TimeEntry>();
            foreach (var entry in seededLeaveEntries.Where(e => e.TicketId != cpTicket.Id))
            {
                if (cpDates.Contains(entry.Date))
                {
                    toDelete.Add(entry);
                    continue;
                }

                entry.TicketId = cpTicket.Id;
                cpDates.Add(entry.Date);
            }

            if (toDelete.Count > 0)
                db.TimeEntries.RemoveRange(toDelete);

            db.SaveChanges();
        }

        var ticketIdsWithEntries = db.TimeEntries
            .Where(e => e.TicketId != null)
            .Select(e => e.TicketId!.Value)
            .Distinct()
            .ToHashSet();

        var removableLegacyLeaveTickets = db.Tickets
            .Where(t => t.Type == TicketType.ABSENT && t.Id != cpTicket.Id)
            .ToList()
            .Where(t => !ticketIdsWithEntries.Contains(t.Id))
            .ToList();

        if (removableLegacyLeaveTickets.Count == 0)
            return;

        db.Tickets.RemoveRange(removableLegacyLeaveTickets);
        db.SaveChanges();
    }
}

