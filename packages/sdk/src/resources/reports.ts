import type { HttpClient } from '../utils/http';

export interface TTRReportParams {
  startDate?: string;
  endDate?: string;
  format?: 'json' | 'csv' | 'download';
}

export interface TTRReport {
  reportId: string;
  tenantName: string;
  reportingPeriod: {
    start: string;
    end: string;
  };
  transactions: Array<{
    id: string;
    reference: string;
    customerId: string;
    customerName: string;
    amount: number;
    currency: string;
    date: string;
    description?: string;
  }>;
  totalAmount: number;
  transactionCount: number;
}

export class ReportsResource {
  constructor(private readonly http: HttpClient) {}

  async generateTTR(params?: TTRReportParams): Promise<TTRReport | string> {
    if (params?.format === 'csv' || params?.format === 'download') {
      // For file downloads, return the raw response
      return this.http.get<string>('/reports/ttr', params);
    }
    return this.http.get<TTRReport>('/reports/ttr', params);
  }
}
