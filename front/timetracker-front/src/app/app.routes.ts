import { Routes } from '@angular/router';
import { TimesheetPage } from './features/timesheet/timesheet-page/timesheet-page';

export const routes: Routes = [
  { path: '', redirectTo: 'timesheet', pathMatch: 'full' },
  { path: 'timesheet', component: TimesheetPage }
];
