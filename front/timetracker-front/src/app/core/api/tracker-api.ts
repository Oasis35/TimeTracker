import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  MetadataDto,
  TimesheetMonthDto,
  Ticket,
  UpsertTimeEntryDto
} from '../models/dtos';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TrackerApiService {

  private readonly baseUrl = '/api';

  constructor(private http: HttpClient) {}

  getTickets(): Observable<Ticket[]> {
    return this.http.get<Ticket[]>(`${this.baseUrl}/tickets`);
  }

  getMetadata(): Observable<MetadataDto> {
    return this.http.get<MetadataDto>(`${this.baseUrl}/timesheet/metadata`);
  }

  getTimesheet(year: number, month: number): Observable<TimesheetMonthDto> {
    return this.http.get<TimesheetMonthDto>(
      `${this.baseUrl}/timesheet`,
      { params: { year, month } }
    );
  }

  upsert(dto: UpsertTimeEntryDto): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/timeentries/upsert`,
      dto
    );
  }
}
