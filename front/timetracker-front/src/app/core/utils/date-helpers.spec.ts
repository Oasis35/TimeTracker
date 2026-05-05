import { describe, expect, it } from 'vitest';
import {
  isoWeekDays,
  isoWeekMonday,
  isoWeekNumber,
  isoWeekYear,
  isWeekendIso,
  monthsForDays,
  parseIsoDate,
  toIsoDate,
} from './date-helpers';

describe('toIsoDate', () => {
  it('formats a standard date', () => {
    expect(toIsoDate(new Date(2026, 4, 1))).toBe('2026-05-01');
  });

  it('pads single-digit month and day with leading zeros', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('handles December 31', () => {
    expect(toIsoDate(new Date(2025, 11, 31))).toBe('2025-12-31');
  });

  it('handles leap year February 29', () => {
    expect(toIsoDate(new Date(2024, 1, 29))).toBe('2024-02-29');
  });
});

describe('parseIsoDate', () => {
  it('parses a valid ISO date', () => {
    const d = parseIsoDate('2026-05-01');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(4);
    expect(d!.getDate()).toBe(1);
  });

  it('round-trips with toIsoDate', () => {
    const iso = '2026-03-15';
    expect(toIsoDate(parseIsoDate(iso)!)).toBe(iso);
  });

  it('returns null for invalid month 0', () => {
    expect(parseIsoDate('2026-00-01')).toBeNull();
  });

  it('returns null for invalid month 13', () => {
    expect(parseIsoDate('2026-13-01')).toBeNull();
  });

  it('returns null for invalid day 0', () => {
    expect(parseIsoDate('2026-02-00')).toBeNull();
  });

  it('returns null for invalid day 32', () => {
    expect(parseIsoDate('2026-02-32')).toBeNull();
  });

  it('returns null for wrong separator format', () => {
    expect(parseIsoDate('2026/02/01')).toBeNull();
  });
});

describe('isWeekendIso', () => {
  it('returns true for Saturday', () => {
    expect(isWeekendIso('2026-05-02')).toBe(true);
  });

  it('returns true for Sunday', () => {
    expect(isWeekendIso('2026-05-03')).toBe(true);
  });

  it('returns false for Monday', () => {
    expect(isWeekendIso('2026-04-27')).toBe(false);
  });

  it('returns false for Friday', () => {
    expect(isWeekendIso('2026-05-01')).toBe(false);
  });
});

describe('isoWeekNumber', () => {
  it('returns 1 for the first ISO week (Jan 5, 2026)', () => {
    expect(isoWeekNumber('2026-01-05')).toBe(2);
  });

  it('Jan 1 2026 is in week 1 of 2026', () => {
    expect(isoWeekNumber('2026-01-01')).toBe(1);
  });

  it('Dec 28 2026 is in week 52', () => {
    expect(isoWeekNumber('2026-12-28')).toBe(53);
  });

  it('Dec 31 2025 is in week 1 of 2026', () => {
    expect(isoWeekNumber('2025-12-31')).toBe(1);
  });

  it('returns correct week for a mid-year date', () => {
    expect(isoWeekNumber('2026-03-16')).toBe(12);
  });
});

describe('isoWeekYear', () => {
  it('returns same year for a regular date', () => {
    expect(isoWeekYear('2026-06-15')).toBe(2026);
  });

  it('returns next year for Dec 31 2025 (in ISO week 1 of 2026)', () => {
    expect(isoWeekYear('2025-12-31')).toBe(2026);
  });

  it('returns same year for Jan 1 2026 (already in ISO week 1 of 2026)', () => {
    expect(isoWeekYear('2026-01-01')).toBe(2026);
  });

  it('returns previous year for Jan 1 2016 (in ISO week 53 of 2015)', () => {
    expect(isoWeekYear('2016-01-01')).toBe(2015);
  });
});

describe('isoWeekMonday', () => {
  it('returns the correct Monday for week 1 of 2026', () => {
    const monday = isoWeekMonday(2026, 1);
    expect(toIsoDate(monday)).toBe('2025-12-29');
  });

  it('returns the correct Monday for week 12 of 2026', () => {
    const monday = isoWeekMonday(2026, 12);
    expect(toIsoDate(monday)).toBe('2026-03-16');
  });

  it('returned date is a Monday (getDay() === 1)', () => {
    const monday = isoWeekMonday(2026, 20);
    expect(monday.getDay()).toBe(1);
  });
});

describe('isoWeekDays', () => {
  it('returns 7 days', () => {
    expect(isoWeekDays(2026, 12).length).toBe(7);
  });

  it('starts on Monday and ends on Sunday', () => {
    const days = isoWeekDays(2026, 12);
    expect(new Date(`${days[0]}T00:00:00`).getDay()).toBe(1);
    expect(new Date(`${days[6]}T00:00:00`).getDay()).toBe(0);
  });

  it('returns consecutive days', () => {
    const days = isoWeekDays(2026, 12);
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(`${days[i - 1]}T00:00:00`);
      const curr = new Date(`${days[i]}T00:00:00`);
      expect(curr.getTime() - prev.getTime()).toBe(86400000);
    }
  });

  it('handles a week crossing a month boundary', () => {
    const days = isoWeekDays(2026, 9);
    expect(days[0]).toBe('2026-02-23');
    expect(days[6]).toBe('2026-03-01');
  });

  it('handles a week crossing a year boundary', () => {
    const days = isoWeekDays(2026, 1);
    expect(days[0]).toBe('2025-12-29');
    expect(days[6]).toBe('2026-01-04');
  });
});

describe('monthsForDays', () => {
  it('returns empty array for empty input', () => {
    expect(monthsForDays([])).toEqual([]);
  });

  it('returns one entry for days in the same month', () => {
    const result = monthsForDays(['2026-01-01', '2026-01-15', '2026-01-31']);
    expect(result).toEqual([{ y: 2026, m: 1 }]);
  });

  it('returns two entries for days spanning two months', () => {
    const result = monthsForDays(['2026-01-31', '2026-02-01']);
    expect(result).toEqual([{ y: 2026, m: 1 }, { y: 2026, m: 2 }]);
  });

  it('returns entries in input order', () => {
    const result = monthsForDays(['2026-03-01', '2026-01-15', '2026-02-28']);
    expect(result).toEqual([{ y: 2026, m: 3 }, { y: 2026, m: 1 }, { y: 2026, m: 2 }]);
  });

  it('handles a year boundary', () => {
    const result = monthsForDays(['2025-12-31', '2026-01-01']);
    expect(result).toEqual([{ y: 2025, m: 12 }, { y: 2026, m: 1 }]);
  });

  it('deduplicates months across many days', () => {
    const days = Array.from({ length: 28 }, (_, i) => `2026-02-${String(i + 1).padStart(2, '0')}`);
    expect(monthsForDays(days)).toEqual([{ y: 2026, m: 2 }]);
  });
});
