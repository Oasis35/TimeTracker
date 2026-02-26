import { TimesheetMonthDto, TimesheetRowDto } from '../../../core/api/models';

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function parseIsoDate(isoDate: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function getMonthDays(year: number, month: number): string[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    return `${year}-${pad2(month)}-${pad2(day)}`;
  });
}

function isInSelectedMonth(isoDate: string, year: number, month: number): boolean {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return false;
  return parsed.year === year && parsed.month === month;
}

export function aggregateDailyTotals(
  rows: TimesheetRowDto[],
  year: number,
  month: number,
): Record<string, number> {
  const totalsByDay: Record<string, number> = {};

  for (const dayIso of getMonthDays(year, month)) {
    totalsByDay[dayIso] = 0;
  }

  for (const row of rows) {
    for (const [dayIso, minutes] of Object.entries(row.values ?? {})) {
      if (!isInSelectedMonth(dayIso, year, month)) continue;
      totalsByDay[dayIso] = (totalsByDay[dayIso] ?? 0) + minutes;
    }
  }

  return totalsByDay;
}

export function calculateMonthTotal(totalsByDay: Record<string, number>): number {
  return Object.values(totalsByDay).reduce((sum, current) => sum + current, 0);
}

export type MonthDaySummary = {
  iso: string;
  day: number;
  totalMinutes: number;
  tickets: DayTicketSummary[];
};

export type DayTicketSummary = {
  ticketId: number;
  title: string;
  minutes: number;
};

export type TicketDayEntry = {
  iso: string;
  day: number;
  minutes: number;
};

export type MonthTicketSummary = {
  ticketId: number;
  title: string;
  totalMinutes: number;
  entries: TicketDayEntry[];
};

function buildTicketTitle(row: TimesheetRowDto): string {
  return [row.type, row.externalKey, row.label].map((part) => (part ?? '').trim()).filter(Boolean).join(' - ');
}

export function createMonthDaySummaries(monthData: TimesheetMonthDto): MonthDaySummary[] {
  const days = getMonthDays(monthData.year, monthData.month);
  const totalsByDay = aggregateDailyTotals(monthData.rows, monthData.year, monthData.month);
  const ticketsByDay = new Map<string, DayTicketSummary[]>();

  for (const dayIso of days) {
    ticketsByDay.set(dayIso, []);
  }

  for (const row of monthData.rows) {
    for (const [dayIso, minutes] of Object.entries(row.values ?? {})) {
      if (!isInSelectedMonth(dayIso, monthData.year, monthData.month) || minutes <= 0) continue;
      const dayTickets = ticketsByDay.get(dayIso);
      if (!dayTickets) continue;
      dayTickets.push({
        ticketId: row.ticketId,
        title: buildTicketTitle(row),
        minutes,
      });
    }
  }

  for (const dayTickets of ticketsByDay.values()) {
    dayTickets.sort((left, right) => right.minutes - left.minutes);
  }

  return days.map((dayIso) => ({
    iso: dayIso,
    day: Number(dayIso.slice(-2)),
    totalMinutes: totalsByDay[dayIso] ?? 0,
    tickets: ticketsByDay.get(dayIso) ?? [],
  }));
}

export function createMonthTicketSummaries(monthData: TimesheetMonthDto): MonthTicketSummary[] {
  return monthData.rows
    .map((row) => {
      const entries = Object.entries(row.values ?? {})
        .filter(([dayIso, minutes]) => isInSelectedMonth(dayIso, monthData.year, monthData.month) && minutes > 0)
        .map(([dayIso, minutes]) => ({
          iso: dayIso,
          day: Number(dayIso.slice(-2)),
          minutes,
        }))
        .sort((left, right) => left.iso.localeCompare(right.iso));

      return {
        ticketId: row.ticketId,
        title: buildTicketTitle(row),
        totalMinutes: entries.reduce((sum, entry) => sum + entry.minutes, 0),
        entries,
      };
    })
    .filter((ticket) => ticket.totalMinutes > 0)
    .sort((left, right) => right.totalMinutes - left.totalMinutes || left.title.localeCompare(right.title));
}
