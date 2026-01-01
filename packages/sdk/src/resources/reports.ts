import type { HttpClient } from '../utils/http';

export interface TTRReportParams {
  startDate?: string;
  endDate?: string;
  format?: 'json' | 'csv' | 'download';
  [key: string]: string | undefined;
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

export interface SMRReportInput {
  activityType: 'money_laundering' | 'terrorism_financing' | 'other';
  description: string;
  suspicionFormedDate: string;
  customerId?: string;
  transactionIds: string[];
  groundsForSuspicion: string;
  actionTaken: string;
  reportingOfficer: {
    name: string;
    position: string;
    contactNumber: string;
  };
  additionalInformation?: string;
  format?: 'json' | 'xml' | 'download';
}

export interface SMRReport {
  reportId: string;
  submissionDate: string;
  tenantName: string;
  suspectedActivity: {
    id: string;
    type: 'money_laundering' | 'terrorism_financing' | 'other';
    description: string;
    suspicionFormedDate: string;
    customerId?: string;
    customerName?: string;
    transactionIds: string[];
    totalAmount: number;
    currency: string;
  };
  groundsForSuspicion: string;
  actionTaken: string;
  reportingOfficer: {
    name: string;
    position: string;
    contactNumber: string;
  };
  additionalInformation?: string;
  transactions: Array<{
    id: string;
    date: string;
    amount: number;
    currency: string;
    type: string;
    description?: string;
    parties: {
      from?: string;
      to?: string;
    };
  }>;
}

export interface IFTIReportParams {
  startDate?: string;
  endDate?: string;
  format?: 'json' | 'xml' | 'csv' | 'download';
  [key: string]: string | undefined;
}

export interface IFTIReport {
  reportId: string;
  reportingPeriod: {
    start: string;
    end: string;
  };
  tenantName: string;
  transfers: Array<{
    id: string;
    transferDate: string;
    amount: number;
    currency: string;
    direction: 'inbound' | 'outbound';
    orderingCustomer: {
      name: string;
      accountNumber?: string;
      address?: string;
      country: string;
    };
    beneficiaryCustomer: {
      name: string;
      accountNumber?: string;
      address?: string;
      country: string;
    };
    orderingInstitution?: {
      name: string;
      bic?: string;
      country: string;
    };
    beneficiaryInstitution?: {
      name: string;
      bic?: string;
      country: string;
    };
    intermediaryInstitution?: {
      name: string;
      bic?: string;
      country: string;
    };
    remittanceInformation?: string;
  }>;
  totalTransfers: number;
  totalAmount: number;
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

  async generateSMR(input: SMRReportInput): Promise<SMRReport | string> {
    if (input.format === 'xml' || input.format === 'download') {
      return this.http.post<string>('/reports/smr', input);
    }
    return this.http.post<SMRReport>('/reports/smr', input);
  }

  async listSMR(params?: { limit?: number; offset?: number; status?: string; activityType?: string }): Promise<{
    object: 'list';
    data: SMRReport[];
    hasMore: boolean;
    totalCount: number;
  }> {
    return this.http.get('/reports/smr', params);
  }

  async generateIFTI(params?: IFTIReportParams): Promise<IFTIReport | string> {
    if (params?.format === 'xml' || params?.format === 'csv' || params?.format === 'download') {
      return this.http.get<string>('/reports/ifti', params);
    }
    return this.http.get<IFTIReport>('/reports/ifti', params);
  }
}
