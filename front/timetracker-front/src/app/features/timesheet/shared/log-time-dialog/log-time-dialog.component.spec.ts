import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { vi } from 'vitest';
import { LogTimeDialogComponent, LogTimeDialogData } from './log-time-dialog.component';
import { TicketDto } from '../../../../core/api/models';
import { provideNativeDateAdapter } from '@angular/material/core';

const ticket1: TicketDto = { id: 1, type: 'DEV', externalKey: 'ABC-1', label: 'Ticket A' };
const ticket2: TicketDto = { id: 2, type: 'DEV', externalKey: 'ABC-2', label: 'Ticket B' };

const defaultData: LogTimeDialogData = {
  year: 2026,
  month: 3,
  defaultTickets: [ticket1],
  allTickets: [ticket1, ticket2],
  options: [
    { minutes: 60, label: '1h' },
    { minutes: 120, label: '2h' },
    { minutes: 480, label: '1j' },
  ],
  dateLocale: 'fr-FR',
  publicHolidays: {},
};

function setup(data: LogTimeDialogData = defaultData) {
  const closeSpy = vi.fn();
  TestBed.configureTestingModule({
    imports: [LogTimeDialogComponent, TranslateModule.forRoot()],
    providers: [
      { provide: MatDialogRef, useValue: { close: closeSpy } },
      { provide: MAT_DIALOG_DATA, useValue: data },
      provideNativeDateAdapter(),
    ],
  });
  const fixture = TestBed.createComponent(LogTimeDialogComponent);
  return { fixture, component: fixture.componentInstance, closeSpy };
}

describe('LogTimeDialogComponent', () => {
  it('initializes with no ticket and no date selected', () => {
    const { component } = setup();
    expect(component.selectedTicket()).toBeNull();
    expect(component.selectedDate()).toBeNull();
  });

  it('preselectes ticket when preselectedTicket is provided', () => {
    const { component } = setup({ ...defaultData, preselectedTicket: ticket2 });
    expect(component.selectedTicket()).toEqual(ticket2);
  });

  it('canSave is false when ticket, date, or minutes is missing', () => {
    const { component } = setup();
    expect(component.canSave()).toBe(false);
  });

  it('canSave is false when ticket is selected but date and minutes are missing', () => {
    const { component } = setup();
    component.onTicketSelected(ticket1);
    expect(component.canSave()).toBe(false);
  });

  it('canSave is false when ticket and date are selected but minutes is 0', () => {
    const { component } = setup();
    component.onTicketSelected(ticket1);
    component.onDateChange(new Date(2026, 2, 10));
    expect(component.canSave()).toBe(false);
  });

  it('canSave is true when ticket, date, and minutes > 0 are all set', () => {
    const { component } = setup();
    component.onTicketSelected(ticket1);
    component.onDateChange(new Date(2026, 2, 10));
    component.selectedMinutes.set(120);
    expect(component.canSave()).toBe(true);
  });

  it('close() closes the dialog without a result', () => {
    const { component, closeSpy } = setup();
    component.close();
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(closeSpy).toHaveBeenCalledWith();
  });

  it('save() does nothing when canSave is false', () => {
    const { component, closeSpy } = setup();
    component.save();
    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('save() closes with correct result when canSave is true', () => {
    const { component, closeSpy } = setup();
    component.onTicketSelected(ticket1);
    component.onDateChange(new Date(2026, 2, 10));
    component.selectedMinutes.set(120);

    component.save();

    expect(closeSpy).toHaveBeenCalledWith({
      ticketId: 1,
      date: '2026-03-10',
      minutes: 120,
    });
  });

  it('save() formats single-digit day and month with leading zeros', () => {
    const { component, closeSpy } = setup();
    component.onTicketSelected(ticket1);
    component.onDateChange(new Date(2026, 2, 5));
    component.selectedMinutes.set(60);

    component.save();

    expect(closeSpy).toHaveBeenCalledWith({
      ticketId: 1,
      date: '2026-03-05',
      minutes: 60,
    });
  });

  it('dateFilter rejects weekends', () => {
    const { component } = setup();
    const saturday = new Date(2026, 2, 7);
    const sunday = new Date(2026, 2, 8);
    expect(component.dateFilter(saturday)).toBe(false);
    expect(component.dateFilter(sunday)).toBe(false);
  });

  it('dateFilter accepts weekdays', () => {
    const { component } = setup();
    const monday = new Date(2026, 2, 9);
    expect(component.dateFilter(monday)).toBe(true);
  });

  it('dateFilter rejects public holidays', () => {
    const { component } = setup({
      ...defaultData,
      publicHolidays: { '2026-03-10': 'Jour Férié Test' },
    });
    const holiday = new Date(2026, 2, 10);
    expect(component.dateFilter(holiday)).toBe(false);
  });

  it('dateFilter rejects null', () => {
    const { component } = setup();
    expect(component.dateFilter(null)).toBe(false);
  });

  it('minDate is first day of the given month', () => {
    const { component } = setup();
    expect(component.minDate.getFullYear()).toBe(2026);
    expect(component.minDate.getMonth()).toBe(2);
    expect(component.minDate.getDate()).toBe(1);
  });

  it('maxDate is last day of the given month', () => {
    const { component } = setup();
    expect(component.maxDate.getFullYear()).toBe(2026);
    expect(component.maxDate.getMonth()).toBe(2);
    expect(component.maxDate.getDate()).toBe(31);
  });
});
