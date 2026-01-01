import { SanctionsResource } from './resources/sanctions';
import { CustomersResource } from './resources/customers';
import { TransactionsResource } from './resources/transactions';
import { RiskResource } from './resources/risk';
import { WebhooksResource } from './resources/webhooks';
import { KycResource } from './resources/kyc';
import { AuditLogsResource } from './resources/audit-logs';
import { TenantsResource } from './resources/tenants';
import { PepResource } from './resources/pep';
import { AnalyticsResource } from './resources/analytics';
import { ReportsResource } from './resources/reports';
import { HttpClient } from './utils/http';
import type { CompliiConfig } from './types';

export class Complii {
  private httpClient: HttpClient;

  public readonly sanctions: SanctionsResource;
  public readonly customers: CustomersResource;
  public readonly transactions: TransactionsResource;
  public readonly risk: RiskResource;
  public readonly webhooks: WebhooksResource;
  public readonly kyc: KycResource;
  public readonly auditLogs: AuditLogsResource;
  public readonly tenants: TenantsResource;
  public readonly pep: PepResource;
  public readonly analytics: AnalyticsResource;
  public readonly reports: ReportsResource;

  constructor(config: CompliiConfig) {
    if (!config.apiKey) {
      throw new Error('Complii: API key is required');
    }

    const baseUrl =
      config.baseUrl ??
      (config.environment === 'staging'
        ? 'https://api-staging.complii.com.au/v1'
        : 'https://api.complii.com.au/v1');

    this.httpClient = new HttpClient({
      baseUrl,
      apiKey: config.apiKey,
      timeout: config.timeout ?? 30000,
    });

    this.sanctions = new SanctionsResource(this.httpClient);
    this.customers = new CustomersResource(this.httpClient);
    this.transactions = new TransactionsResource(this.httpClient);
    this.risk = new RiskResource(this.httpClient);
    this.webhooks = new WebhooksResource(this.httpClient);
    this.kyc = new KycResource(this.httpClient);
    this.auditLogs = new AuditLogsResource(this.httpClient);
    this.tenants = new TenantsResource(this.httpClient);
    this.pep = new PepResource(this.httpClient);
    this.analytics = new AnalyticsResource(this.httpClient);
    this.reports = new ReportsResource(this.httpClient);
  }
}

export default Complii;
