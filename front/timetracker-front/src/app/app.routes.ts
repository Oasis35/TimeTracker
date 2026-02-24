import { Routes } from '@angular/router';
import { TimesheetPageComponent } from './features/timesheet/timesheet-page/timesheet-page';

export const routes: Routes = [
    { path: '', component: TimesheetPageComponent },
  { path: '**', redirectTo: '' },
];
