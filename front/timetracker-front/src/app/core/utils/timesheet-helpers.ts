import { TimesheetMetadataDto } from '../api/models';
import { formatMinutes } from './number-helpers';

export type QuickPickOption = { minutes: number; label: string };

export function buildQuickPickOptions(
  meta: TimesheetMetadataDto,
  unitMode: 'day' | 'hour',
): QuickPickOption[] {
  const allowed =
    unitMode === 'hour' ? meta.allowedMinutesHourMode : meta.allowedMinutesDayMode;
  return allowed.map((minutes) => ({
    minutes,
    label: formatMinutes(minutes, meta.minutesPerDay, unitMode),
  }));
}
