import { TimesheetMonthDto } from '../../../core/api/models';
import {
  aggregateDailyTotals,
  calculateMonthTotal,
  createMonthDaySummaries,
  getMonthDays,
} from './monthly-utils';

describe('monthly-utils', () => {
  it('generates every day in a month including boundaries', () => {
    const days = getMonthDays(2026, 2);
    expect(days[0]).toBe('2026-02-01');
    expect(days[days.length - 1]).toBe('2026-02-28');
    expect(days.length).toBe(28);
  });

  it('aggregates day totals and includes zero-value days', () => {
    const totals = aggregateDailyTotals(
      [
        {
          ticketId: 1,
          type: 'DEV',
          externalKey: 'A-1',
          label: 'A',
          values: { '2026-02-01': 60, '2026-02-15': 120, '2026-03-01': 480 },
          total: 180,
        },
        {
          ticketId: 2,
          type: 'SUPPORT',
          externalKey: 'B-1',
          label: 'B',
          values: { '2026-02-01': 30 },
          total: 30,
        },
      ],
      2026,
      2,
    );

    expect(totals['2026-02-01']).toBe(90);
    expect(totals['2026-02-15']).toBe(120);
    expect(totals['2026-02-02']).toBe(0);
    expect(totals['2026-03-01']).toBeUndefined();
  });

  it('computes month total from daily totals', () => {
    expect(calculateMonthTotal({ '2026-02-01': 90, '2026-02-02': 0, '2026-02-15': 120 })).toBe(
      210,
    );
  });

  it('creates day summaries for full month range', () => {
    const monthData: TimesheetMonthDto = {
      year: 2026,
      month: 2,
      days: ['2026-02-01'],
      rows: [
        {
          ticketId: 1,
          type: 'DEV',
          externalKey: '',
          label: '',
          values: { '2026-02-10': 240 },
          total: 240,
        },
      ],
      totalsByDay: {},
      minutesPerDay: 480,
    };

    const summaries = createMonthDaySummaries(monthData);
    expect(summaries.length).toBe(28);
    expect(summaries.find((day) => day.iso === '2026-02-10')?.totalMinutes).toBe(240);
    expect(summaries.find((day) => day.iso === '2026-02-09')?.totalMinutes).toBe(0);
    const dayWithEntry = summaries.find((day) => day.iso === '2026-02-10');
    expect(dayWithEntry?.tickets.length).toBe(1);
    expect(dayWithEntry?.tickets[0].title).toContain('DEV');
    expect(dayWithEntry?.tickets[0].minutes).toBe(240);
  });
});
