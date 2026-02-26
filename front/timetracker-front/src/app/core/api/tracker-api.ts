import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CreateTicketDto,
  TicketDto,
  TimesheetMetadataDto,
  TimesheetMonthDto,
  UpsertTimeEntryDto,
} from './models';

@Injectable({ providedIn: 'root' })
export class TrackerApi {
  constructor(private http: HttpClient) {}

  getMetadata(): Observable<TimesheetMetadataDto> {
    return this.http.get<TimesheetMetadataDto>('/api/timesheet/metadata');
  }

  getMonth(year: number, month: number): Observable<TimesheetMonthDto> {
    const params = new HttpParams().set('year', year).set('month', month);
    return this.http.get<TimesheetMonthDto>('/api/timesheet', { params });
  }

  getUsedByMonth(year: number, month: number): Observable<TicketDto[]> {
    const params = new HttpParams().set('year', year).set('month', month);
    return this.http.get<TicketDto[]>('/api/tickets/used', { params });
  }

  createTicket(dto: CreateTicketDto): Observable<TicketDto> {
    return this.http.post<TicketDto>('/api/tickets', dto);
  }

  upsertTimeEntry(dto: UpsertTimeEntryDto): Observable<void> {
    return this.http.post<void>('/api/timeentries/upsert', dto);
  }
}
