import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TrackerApi } from './tracker-api';

describe('TrackerApi', () => {
  let api: TrackerApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TrackerApi,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    api = TestBed.inject(TrackerApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('calls lookup endpoint with query and take params', () => {
    api.lookupOpenTicketsByNumber('6501', 8).subscribe();

    const req = http.expectOne((request) => request.method === 'GET' && request.url === '/api/tickets/lookup');
    expect(req.request.params.get('q')).toBe('6501');
    expect(req.request.params.get('take')).toBe('8');
    req.flush([]);
  });

  it('uses default take when omitted', () => {
    api.lookupOpenTicketsByNumber('42').subscribe();

    const req = http.expectOne((request) => request.method === 'GET' && request.url === '/api/tickets/lookup');
    expect(req.request.params.get('q')).toBe('42');
    expect(req.request.params.get('take')).toBe('10');
    req.flush([]);
  });
});
