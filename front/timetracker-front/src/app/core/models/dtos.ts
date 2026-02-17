export interface Ticket {
  id: number;
  type: string;
  externalKey: string | null;
  label: string | null;
}

export interface TimesheetRowDto {
  ticketId: number;
  type: string;
  externalKey: string;
  label: string;
  values: Record<string, number>;
  total: number;
}

export interface TimesheetMonthDto {
  year: number;
  month: number;
  days: string[];
  rows: TimesheetRowDto[];
  totalsByDay: Record<string, number>;
}

export interface MetadataDto {
  allowedQuantities: number[];
  tickets: Ticket[];
}

export interface UpsertTimeEntryDto {
  ticketId: number;
  date: string;
  quantity: number;
  comment?: string | null;
}
