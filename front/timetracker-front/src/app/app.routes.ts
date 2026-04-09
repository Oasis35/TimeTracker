import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'month',
  },
  {
    path: 'maintenance',
    loadComponent: () =>
      import('./features/settings/maintenance/maintenance').then(
        (m) => m.MaintenancePageComponent,
      ),
  },
  {
    path: 'day',
    loadComponent: () =>
      import('./features/timesheet/timesheet-day-page/timesheet-day-page').then(
        (m) => m.TimesheetDayPageComponent,
      ),
  },
  {
    path: 'month',
    loadComponent: () =>
      import('./features/timesheet/timesheet-month-page/timesheet-month-page').then(
        (m) => m.TimesheetMonthPageComponent,
      ),
  },
  {
    path: 'tickets-grid',
    loadComponent: () =>
      import('./features/tickets-grid/tickets-grid-page/tickets-grid-page').then(
        (m) => m.TicketsGridPageComponent,
      ),
  },
  {
    path: 'ticket/:ticketId',
    loadComponent: () =>
      import('./features/tickets/ticket-detail-page/ticket-detail-page').then(
        (m) => m.TicketDetailPageComponent,
      ),
  },
  {
    path: '404',
    loadComponent: () =>
      import('./features/not-found/not-found-page/not-found-page').then(
        (m) => m.NotFoundPageComponent,
      ),
  },
  { path: '**', redirectTo: '404' },
];
