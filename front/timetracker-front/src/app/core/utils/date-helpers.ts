function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(isoDate: string): Date | null {
  const [yearRaw, monthRaw, dayRaw] = isoDate.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return new Date(year, month - 1, day);
}

export function isWeekendIso(isoDate: string): boolean {
  const day = new Date(`${isoDate}T00:00:00`).getDay();
  return day === 0 || day === 6;
}

export function isoWeekNumber(isoDate: string): number {
  const d = new Date(`${isoDate}T00:00:00`);
  const thu = new Date(d);
  thu.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(thu.getFullYear(), 0, 1);
  return Math.ceil(((thu.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** ISO year owning the week (may differ from calendar year near Jan 1). */
export function isoWeekYear(isoDate: string): number {
  const d = new Date(`${isoDate}T00:00:00`);
  const thu = new Date(d);
  thu.setDate(d.getDate() + 4 - (d.getDay() || 7));
  return thu.getFullYear();
}

/** Monday date of ISO week `week` in ISO year `year`. */
export function isoWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4);
  const dow = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - (dow - 1) + (week - 1) * 7);
  return monday;
}

/** 7 ISO date strings Mon→Sun for ISO week `week` of ISO year `year`. */
export function isoWeekDays(year: number, week: number): string[] {
  const monday = isoWeekMonday(year, week);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toIsoDate(d);
  });
}

/** Deduplicated { y, m } pairs needed to cover `days`. */
export function monthsForDays(days: string[]): { y: number; m: number }[] {
  const seen = new Set<string>();
  const result: { y: number; m: number }[] = [];
  for (const day of days) {
    const y = Number(day.slice(0, 4));
    const m = Number(day.slice(5, 7));
    const key = `${y}-${m}`;
    if (!seen.has(key)) { seen.add(key); result.push({ y, m }); }
  }
  return result;
}
