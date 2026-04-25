import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { vi } from 'vitest';
import { TimeEntryDialogComponent, TimeEntryDialogData } from './time-entry-dialog.component';
import { provideNativeDateAdapter } from '@angular/material/core';

const defaultData: TimeEntryDialogData = {
  date: '2026-03-10',
  quantityMinutes: 120,
  monthKey: '2026-03',
  usedDates: [],
  quickPickOptions: [
    { minutes: 0, label: '0' },
    { minutes: 60, label: '1h' },
    { minutes: 120, label: '2h' },
    { minutes: 480, label: '1j' },
  ],
  publicHolidays: {},
  locale: 'fr-FR',
  isNew: false,
};

function setup(data: TimeEntryDialogData = defaultData) {
  const closeSpy = vi.fn();
  TestBed.configureTestingModule({
    imports: [TimeEntryDialogComponent, TranslateModule.forRoot()],
    providers: [
      { provide: MatDialogRef, useValue: { close: closeSpy } },
      { provide: MAT_DIALOG_DATA, useValue: data },
      provideNativeDateAdapter(),
    ],
  });
  const fixture = TestBed.createComponent(TimeEntryDialogComponent);
  return { fixture, component: fixture.componentInstance, closeSpy };
}

describe('TimeEntryDialogComponent (shared)', () => {
  it('initializes selectedDate from data.date', () => {
    const { component } = setup();
    expect(component.selectedDate).not.toBeNull();
    expect(component.selectedDate?.getFullYear()).toBe(2026);
    expect(component.selectedDate?.getMonth()).toBe(2);
    expect(component.selectedDate?.getDate()).toBe(10);
  });

  it('initializes selectedDate to null when data.date is null', () => {
    const { component } = setup({ ...defaultData, date: null });
    expect(component.selectedDate).toBeNull();
  });

  it('initializes selectedMinutes from data.quantityMinutes', () => {
    const { component } = setup();
    expect(component.selectedMinutes).toBe(120);
  });

  it('positiveOptions excludes the 0-minute option', () => {
    const { component } = setup();
    expect(component.positiveOptions.every(o => o.minutes > 0)).toBe(true);
    expect(component.positiveOptions.length).toBe(3);
  });

  it('canSave is false when no date selected', () => {
    const { component } = setup({ ...defaultData, date: null });
    expect(component.canSave).toBe(false);
  });

  it('canSave is false when minutes is 0', () => {
    const { component } = setup({ ...defaultData, quantityMinutes: 0 });
    expect(component.canSave).toBe(false);
  });

  it('canSave is true when date and minutes > 0 are set', () => {
    const { component } = setup();
    expect(component.canSave).toBe(true);
  });

  it('onCancel() closes the dialog with null', () => {
    const { component, closeSpy } = setup();
    component.onCancel();
    expect(closeSpy).toHaveBeenCalledWith(null);
  });

  it('onSave() closes with save action and current values', () => {
    const { component, closeSpy } = setup();
    component.onSave();
    expect(closeSpy).toHaveBeenCalledWith({
      action: 'save',
      date: '2026-03-10',
      quantityMinutes: 120,
    });
  });

  it('onSave() does nothing when canSave is false', () => {
    const { component, closeSpy } = setup({ ...defaultData, date: null });
    component.onSave();
    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('askDelete() sets deletePending to true', () => {
    const { component } = setup();
    expect(component.deletePending).toBe(false);
    component.askDelete();
    expect(component.deletePending).toBe(true);
  });

  it('cancelDelete() resets deletePending to false', () => {
    const { component } = setup();
    component.askDelete();
    component.cancelDelete();
    expect(component.deletePending).toBe(false);
  });

  it('onDelete() closes with delete action', () => {
    const { component, closeSpy } = setup();
    component.onDelete();
    expect(closeSpy).toHaveBeenCalledWith({ action: 'delete' });
  });

  it('dateFilter rejects dates outside the month', () => {
    const { component } = setup();
    const otherMonth = new Date(2026, 1, 28);
    expect(component.dateFilter(otherMonth)).toBe(false);
  });

  it('dateFilter rejects dates already in usedDates', () => {
    const { component } = setup({ ...defaultData, usedDates: ['2026-03-15'] });
    expect(component.dateFilter(new Date(2026, 2, 15))).toBe(false);
  });

  it('dateFilter rejects weekends', () => {
    const { component } = setup();
    const saturday = new Date(2026, 2, 7);
    expect(component.dateFilter(saturday)).toBe(false);
  });

  it('dateFilter rejects public holidays', () => {
    const { component } = setup({ ...defaultData, publicHolidays: { '2026-03-20': 'Jour Férié' } });
    expect(component.dateFilter(new Date(2026, 2, 20))).toBe(false);
  });

  it('dateFilter accepts a valid weekday in the month', () => {
    const { component } = setup();
    const monday = new Date(2026, 2, 9);
    expect(component.dateFilter(monday)).toBe(true);
  });

  it('dateFilter rejects null', () => {
    const { component } = setup();
    expect(component.dateFilter(null)).toBe(false);
  });

  it('minDate is the first day of the month', () => {
    const { component } = setup();
    expect(component.minDate?.getFullYear()).toBe(2026);
    expect(component.minDate?.getMonth()).toBe(2);
    expect(component.minDate?.getDate()).toBe(1);
  });

  it('maxDate is the last day of the month', () => {
    const { component } = setup();
    expect(component.maxDate?.getFullYear()).toBe(2026);
    expect(component.maxDate?.getMonth()).toBe(2);
    expect(component.maxDate?.getDate()).toBe(31);
  });
});
