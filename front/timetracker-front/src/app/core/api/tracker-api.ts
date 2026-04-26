import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  BackupRestoreResponseDto,
  CreateTicketDto,
  TicketDetailDto,
  TicketDto,
  TicketTotalDto,
  TimesheetMetadataDto,
  TimesheetMonthDto,
  UpsertTimeEntryDto,
} from './models';

@Injectable({ providedIn: 'root' })
export class TrackerApi {
  constructor(private readonly http: HttpClient) {}

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

  getAllTickets(): Observable<TicketDto[]> {
    return this.http.get<TicketDto[]>('/api/tickets');
  }

  getTicketTotals(year?: number, month?: number): Observable<TicketTotalDto[]> {
    let params = new HttpParams();
    if (year != null && month != null) {
      params = params.set('year', year).set('month', month);
    }
    return this.http.get<TicketTotalDto[]>('/api/tickets/totals', { params });
  }

  createTicket(dto: CreateTicketDto): Observable<TicketDto> {
    return this.http.post<TicketDto>('/api/tickets', dto);
  }

  updateTicket(ticketId: number, dto: CreateTicketDto): Observable<TicketDto> {
    return this.http.put<TicketDto>(`/api/tickets/${ticketId}`, dto);
  }

  setTicketCompletion(ticketId: number, isCompleted: boolean): Observable<TicketDto> {
    return this.http.patch<TicketDto>(`/api/tickets/${ticketId}/completion`, { isCompleted });
  }

  deleteTicket(ticketId: number): Observable<void> {
    return this.http.delete<void>(`/api/tickets/${ticketId}`);
  }

  upsertTimeEntry(dto: UpsertTimeEntryDto): Observable<void> {
    return this.http.post<void>('/api/timeentries/upsert', dto);
  }

  getTicketDetail(ticketId: number): Observable<TicketDetailDto> {
    return this.http.get<TicketDetailDto>(`/api/tickets/${ticketId}/detail`);
  }

  exportBackup(): Observable<HttpResponse<Blob>> {
    return this.http.post('/api/backup/export', null, {
      observe: 'response',
      responseType: 'blob',
    });
  }

  restoreBackup(file: File): Observable<BackupRestoreResponseDto> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<BackupRestoreResponseDto>('/api/backup/restore', formData);
  }

  getPublicHolidaysMetropole(): Observable<Record<string, string>> {
    return this.http.get<Record<string, string>>('/api/public-holidays');
  }

  getSettings(): Observable<Record<string, string>> {
    return this.http.get<Record<string, string>>('/api/settings');
  }

  setSetting(key: string, value: string): Observable<void> {
    return this.http.put<void>(`/api/settings/${key}`, { value });
  }

  deleteSetting(key: string): Observable<void> {
    return this.http.delete<void>(`/api/settings/${key}`);
  }
}
