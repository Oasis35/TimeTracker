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
});
