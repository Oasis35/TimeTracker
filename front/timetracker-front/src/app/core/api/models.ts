export type UnitMode = 'day' | 'hour';

export interface TicketDto {
  id: number;
  type: string;
  externalKey?: string | null;
  label?: string | null;
  isCompleted: boolean;
}

export interface TicketTotalDto {
  ticketId: number;
  type: string;
  externalKey: string;
  label: string;
  total: number;
}

export interface CreateTicketDto {
  type: string;
  externalKey?: string | null;
  label?: string | null;
}

export interface TimesheetMetadataDto {
  hoursPerDay: number;
  minutesPerDay: number;
  allowedMinutesDayMode: number[];
  allowedMinutesHourMode: number[];
  defaultUnit: UnitMode;
  defaultType: string;
  tickets: TicketDto[];
}

export interface TimesheetRowDto {
  ticketId: number;
  type: string;
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
  minutesPerDay?: number;
}

export interface UpsertTimeEntryDto {
  ticketId: number;
  date: string;
  quantityMinutes: number;
  comment?: string | null;
}
