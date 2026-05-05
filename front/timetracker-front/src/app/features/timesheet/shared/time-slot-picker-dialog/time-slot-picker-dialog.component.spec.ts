import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { vi } from 'vitest';
import { TimeSlotPickerDialogComponent, TimeSlotPickerDialogData } from './time-slot-picker-dialog.component';

describe('TimeSlotPickerDialogComponent', () => {
  const defaultData: TimeSlotPickerDialogData = {
    ticketId: 1,
    ticketRef: 'DEV ABC-1',
    ticketLabel: 'Test ticket',
    dayLabel: '1 mars 2026',
    currentMinutes: 120,
    options: [
      { minutes: 0, label: '0 j' },
      { minutes: 120, label: '0,25 j' },
      { minutes: 240, label: '0,50 j' },
      { minutes: 480, label: '1 j' },
    ],
  };

  const dataWithDatePicker: TimeSlotPickerDialogData = {
    ...defaultData,
    initialDate: '2026-04-14',
    dateLocale: 'fr-FR',
  };

  const dataWithReadonlyDate: TimeSlotPickerDialogData = {
    ...defaultData,
    readonlyDate: '2026-04-14',
    dateLocale: 'fr-FR',
  };

  function setup(data: TimeSlotPickerDialogData = defaultData) {
    const closeSpy = vi.fn();
    TestBed.configureTestingModule({
      imports: [TimeSlotPickerDialogComponent, TranslateModule.forRoot()],
      providers: [
        { provide: MatDialogRef, useValue: { close: closeSpy } },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    });
    const fixture = TestBed.createComponent(TimeSlotPickerDialogComponent);
    return { fixture, component: fixture.componentInstance, closeSpy };
  }

  it('initializes selectedMinutes with currentMinutes from data', () => {
    const { component } = setup();
    expect(component.selectedMinutes()).toBe(120);
  });

  it('initializes with 0 when currentMinutes is 0', () => {
    const { component } = setup({ ...defaultData, currentMinutes: 0 });
    expect(component.selectedMinutes()).toBe(0);
  });

  it('closes without a value on cancel', () => {
    const { component, closeSpy } = setup();
    component.close();
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(closeSpy).toHaveBeenCalledWith();
  });

  it('closes with the initial minutes when save is called without change', () => {
    const { component, closeSpy } = setup();
    component.save();
    expect(closeSpy).toHaveBeenCalledWith(120);
  });

  it('closes with the updated minutes after selection change', () => {
    const { component, closeSpy } = setup();
    component.selectedMinutes.set(480);
    component.save();
    expect(closeSpy).toHaveBeenCalledWith(480);
  });

  it('closes with 0 when zero minutes is selected', () => {
    const { component, closeSpy } = setup();
    component.selectedMinutes.set(0);
    component.save();
    expect(closeSpy).toHaveBeenCalledWith(0);
  });

  describe('showDatePicker / showReadonlyDate', () => {
    it('showDatePicker is false when initialDate is not set', () => {
      const { component } = setup(defaultData);
      expect(component.showDatePicker).toBe(false);
    });

    it('showDatePicker is true when initialDate is provided', () => {
      const { component } = setup(dataWithDatePicker);
      expect(component.showDatePicker).toBe(true);
    });

    it('showReadonlyDate is false when readonlyDate is not set', () => {
      const { component } = setup(defaultData);
      expect(component.showReadonlyDate).toBe(false);
    });

    it('showReadonlyDate is true when readonlyDate is provided', () => {
      const { component } = setup(dataWithReadonlyDate);
      expect(component.showReadonlyDate).toBe(true);
    });

    it('readonlyDateValue is null when readonlyDate is not set', () => {
      const { component } = setup(defaultData);
      expect(component.readonlyDateValue).toBeNull();
    });

    it('readonlyDateValue is the parsed Date when readonlyDate is set', () => {
      const { component } = setup(dataWithReadonlyDate);
      expect(component.readonlyDateValue).toBeInstanceOf(Date);
      expect(component.readonlyDateValue?.getFullYear()).toBe(2026);
      expect(component.readonlyDateValue?.getMonth()).toBe(3); // April = 3
      expect(component.readonlyDateValue?.getDate()).toBe(14);
    });
  });

  describe('save() with date picker mode', () => {
    it('closes with { minutes, date } when date is selected', () => {
      const { component, closeSpy } = setup(dataWithDatePicker);
      component.selectedDate.set(new Date('2026-04-14T00:00:00'));
      component.selectedMinutes.set(240);
      component.save();
      expect(closeSpy).toHaveBeenCalledWith({ minutes: 240, date: '2026-04-14' });
    });

    it('does not close when date picker is shown but no date is selected', () => {
      const { component, closeSpy } = setup(dataWithDatePicker);
      component.selectedDate.set(null);
      component.save();
      expect(closeSpy).not.toHaveBeenCalled();
    });

    it('initializes selectedDate from initialDate', () => {
      const { component } = setup(dataWithDatePicker);
      const date = component.selectedDate();
      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(2026);
      expect(date?.getMonth()).toBe(3); // April
      expect(date?.getDate()).toBe(14);
    });
  });
});
