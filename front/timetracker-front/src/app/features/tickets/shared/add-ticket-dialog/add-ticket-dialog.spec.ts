import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';
import { TrackerApi } from '../../../../core/api/tracker-api';
import { AddTicketDialogComponent } from './add-ticket-dialog';

describe('AddTicketDialogComponent', () => {
  const baseMetadata = {
    minutesPerDay: 480,
    allowedMinutesDayMode: [0, 120, 240, 360, 480],
    allowedMinutesHourMode: [0, 60, 120, 180, 240, 300, 360, 420, 480],
    defaultUnit: 'day' as const,
    defaultType: 'DEV',
    tickets: [],
  };

  const createdTicket = { id: 1, type: 'DEV', externalKey: 'ABC-1', label: 'Test' };

  function setup(options?: { createError?: string; defaultType?: string }) {
    const closeSpy = vi.fn();
    const apiMock = {
      getMetadata: vi.fn(() => of({ ...baseMetadata, defaultType: options?.defaultType ?? 'DEV' })),
      createTicket: vi.fn(() =>
        options?.createError
          ? throwError(() => new HttpErrorResponse({ status: 400, error: { code: options.createError } }))
          : of(createdTicket),
      ),
    };

    TestBed.configureTestingModule({
      imports: [AddTicketDialogComponent, TranslateModule.forRoot()],
      providers: [
        { provide: TrackerApi, useValue: apiMock },
        { provide: MatDialogRef, useValue: { close: closeSpy } },
      ],
    });

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      cannot_create_ticket: 'Cannot create ticket',
      ticket_already_exists: 'Ticket already exists',
    });
    translate.use('en');

    const fixture = TestBed.createComponent(AddTicketDialogComponent);
    return { fixture, component: fixture.componentInstance, closeSpy, apiMock };
  }

  it('closes with false on cancel', () => {
    const { component, closeSpy } = setup();
    component.close();
    expect(closeSpy).toHaveBeenCalledWith(false);
  });

  it('closes with { ticket, logTime: false } when submitting without log', async () => {
    const { fixture, component, closeSpy } = setup();
    fixture.detectChanges();
    await fixture.whenStable();

    await component.submit(false);

    expect(closeSpy).toHaveBeenCalledWith({ ticket: createdTicket, logTime: false });
  });

  it('closes with { ticket, logTime: true } when submitting with log', async () => {
    const { fixture, component, closeSpy } = setup();
    fixture.detectChanges();
    await fixture.whenStable();

    await component.submit(true);

    expect(closeSpy).toHaveBeenCalledWith({ ticket: createdTicket, logTime: true });
  });

  it('shows translated error and resets busy flag on API failure', async () => {
    const { fixture, component } = setup({ createError: 'TT_TICKET_ALREADY_EXISTS' });
    fixture.detectChanges();
    await fixture.whenStable();

    await component.submit(false);

    expect(component.actionError()).toBe('Ticket already exists');
    expect(component.busy()).toBe(false);
  });

  it('shows generic error when API error code is unknown', async () => {
    const { fixture, component } = setup({ createError: 'TT_UNKNOWN' });
    fixture.detectChanges();
    await fixture.whenStable();

    await component.submit(false);

    expect(component.actionError()).toBe('Cannot create ticket');
  });

  it('pre-selects default type from metadata', async () => {
    const { fixture, component } = setup({ defaultType: 'SUPPORT' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.newTicketType()).toBe('SUPPORT');
  });

  it('falls back to first option when metadata default type is unrecognised', async () => {
    const { fixture, component } = setup({ defaultType: 'UNKNOWN' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.newTicketType()).toBe(component.ticketTypeOptions[0]);
  });

  it('trims whitespace from external key and label before submitting', async () => {
    const { fixture, component, apiMock } = setup();
    fixture.detectChanges();
    await fixture.whenStable();

    component.newTicketExternalKey.set('  ABC-1  ');
    component.newTicketLabel.set('  My label  ');

    await component.submit(false);

    expect(apiMock.createTicket).toHaveBeenCalledWith(
      expect.objectContaining({ externalKey: 'ABC-1', label: 'My label' }),
    );
  });

  it('sends null for blank external key and label', async () => {
    const { fixture, component, apiMock } = setup();
    fixture.detectChanges();
    await fixture.whenStable();

    component.newTicketExternalKey.set('');
    component.newTicketLabel.set('');

    await component.submit(false);

    expect(apiMock.createTicket).toHaveBeenCalledWith(
      expect.objectContaining({ externalKey: null, label: null }),
    );
  });
});
