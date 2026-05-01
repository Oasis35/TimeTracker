import { describe, expect, it } from 'vitest';
import { formatMinutes, formatNumberTrimmed } from './number-helpers';

describe('formatNumberTrimmed', () => {
  it('formats an integer without decimals', () => {
    expect(formatNumberTrimmed(100)).toBe('100');
  });

  it('formats zero', () => {
    expect(formatNumberTrimmed(0)).toBe('0');
  });

  it('uses comma as decimal separator', () => {
    expect(formatNumberTrimmed(1.5)).toBe('1,5');
  });

  it('trims trailing zero after decimal', () => {
    expect(formatNumberTrimmed(1.5)).toBe('1,5');
  });

  it('trims both decimal zeros (,00)', () => {
    expect(formatNumberTrimmed(10)).toBe('10');
  });

  it('keeps meaningful second decimal digit', () => {
    expect(formatNumberTrimmed(1.05)).toBe('1,05');
  });

  it('handles negative numbers', () => {
    expect(formatNumberTrimmed(-2.5)).toBe('-2,5');
  });

  it('rounds to 2 decimal places', () => {
    expect(formatNumberTrimmed(1.005)).toBe('1');
  });
});

describe('formatMinutes', () => {
  it('formats 0 minutes in hour mode', () => {
    expect(formatMinutes(0, 480, 'hour')).toBe('0 h');
  });

  it('formats 60 minutes as 1 h', () => {
    expect(formatMinutes(60, 480, 'hour')).toBe('1 h');
  });

  it('formats 90 minutes as 1,5 h', () => {
    expect(formatMinutes(90, 480, 'hour')).toBe('1,5 h');
  });

  it('formats 480 minutes as 8 h (no trailing zeros)', () => {
    expect(formatMinutes(480, 480, 'hour')).toBe('8 h');
  });

  it('formats 0 minutes in day mode', () => {
    expect(formatMinutes(0, 480, 'day')).toBe('0 j');
  });

  it('formats 480 minutes as 1 j with minutesPerDay=480', () => {
    expect(formatMinutes(480, 480, 'day')).toBe('1 j');
  });

  it('formats 240 minutes as 0,5 j with minutesPerDay=480', () => {
    expect(formatMinutes(240, 480, 'day')).toBe('0,5 j');
  });

  it('formats 960 minutes as 2 j with minutesPerDay=480', () => {
    expect(formatMinutes(960, 480, 'day')).toBe('2 j');
  });

  it('formats 120 minutes as 0,25 j with minutesPerDay=480', () => {
    expect(formatMinutes(120, 480, 'day')).toBe('0,25 j');
  });

  it('uses minutesPerDay correctly for a different config (600)', () => {
    expect(formatMinutes(300, 600, 'day')).toBe('0,5 j');
  });
});
