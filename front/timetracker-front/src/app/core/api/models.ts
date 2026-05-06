export type UnitMode = 'day' | 'hour';

export type TicketType = 'DEV' | 'SUPPORT' | 'ABSENT';

export interface TicketDto {
  id: number;
  type: TicketType;
  externalKey?: string | null;
  label?: string | null;
}

export interface TicketTotalDto {
  ticketId: number;
  type: TicketType;
  externalKey: string;
  label: string;
  total: number;
}

export interface TicketTimeEntryDto {
  date: string;
  quantityMinutes: number;
}

export interface TicketDetailDto {
  ticket: TicketDto;
  entries: TicketTimeEntryDto[];
  totalMinutes: number;
  currentMonthMinutes: number;
  previousMonthMinutes: number;
}

export interface CreateTicketDto {
  type: TicketType;
  externalKey?: string | null;
  label?: string | null;
}

export interface TimesheetMetadataDto {
  minutesPerDay: number;
  allowedMinutesDayMode: number[];
  allowedMinutesHourMode: number[];
  defaultUnit: UnitMode;
  defaultType: TicketType;
  tickets: TicketDto[];
}

export interface TimesheetRowDto {
  ticketId: number;
  type: TicketType;
  externalKey: string;
  label: string;
  values: Record<string, number>;
}

export interface TimesheetMonthDto {
  year: number;
  month: number;
  days: string[];
  rows: TimesheetRowDto[];
  totalsByDay: Record<string, number>;
  minutesPerDay: number;
}

export interface UpsertTimeEntryDto {
  ticketId: number;
  date: string;
  quantityMinutes: number;
}

export interface BackupRestoreResponseDto {
  safetyBackupFileName: string;
}

export interface IncompleteDaysDto {
  incompleteDays: string[];
}

export interface DaysExceedingDto {
  count: number;
}
