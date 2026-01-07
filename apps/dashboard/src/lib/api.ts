'use server';

// Server-side API calls for dashboard
const API_BASE_URL = process.env.COMPLII_API_URL || 'http://localhost:3001/api/v1';
const API_KEY = process.env.COMPLII_API_KEY || '';

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      ...options.headers,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `API error: ${response.status}`);
  }

  return response.json();
}

// Customers
export async function getCustomers(params?: {
  limit?: number;
  riskLevel?: string;
  email?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.riskLevel) searchParams.set('risk_level', params.riskLevel);
  if (params?.email) searchParams.set('email', params.email);

  const query = searchParams.toString();
  return apiRequest<{
    object: string;
    data: Customer[];
    hasMore: boolean;
    totalCount: number;
  }>(`/customers${query ? `?${query}` : ''}`);
}

export async function getCustomer(id: string) {
  return apiRequest<Customer>(`/customers/${id}`);
}

export async function createCustomer(data: CustomerCreateInput) {
  return apiRequest<Customer>('/customers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCustomer(id: string, data: Partial<CustomerCreateInput>) {
  return apiRequest<Customer>(`/customers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// Transactions
export async function getTransactions(params?: {
  limit?: number;
  customerId?: string;
  flaggedForReview?: boolean;
}) {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.customerId) searchParams.set('customer_id', params.customerId);
  if (params?.flaggedForReview) searchParams.set('flagged_for_review', 'true');

  const query = searchParams.toString();
  return apiRequest<{
    object: string;
    data: Transaction[];
    hasMore: boolean;
    totalCount: number;
  }>(`/transactions${query ? `?${query}` : ''}`);
}

// Cases
export async function getCases(params?: {
  limit?: number;
  status?: string;
  priority?: string;
  customerId?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.status) searchParams.set('status', params.status);
  if (params?.priority) searchParams.set('priority', params.priority);
  if (params?.customerId) searchParams.set('customer_id', params.customerId);

  const query = searchParams.toString();
  return apiRequest<{
    object: string;
    data: Case[];
    hasMore: boolean;
    totalCount: number;
  }>(`/cases${query ? `?${query}` : ''}`);
}

export async function getCase(id: string) {
  return apiRequest<Case>(`/cases/${id}`);
}

export async function createCase(data: CaseCreateInput) {
  return apiRequest<Case>('/cases', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCase(id: string, data: Partial<CaseUpdateInput>) {
  return apiRequest<Case>(`/cases/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// Alerts
export async function getAlerts(params?: {
  limit?: number;
  status?: string;
  severity?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.status) searchParams.set('status', params.status);
  if (params?.severity) searchParams.set('severity', params.severity);

  const query = searchParams.toString();
  return apiRequest<{
    object: string;
    data: Alert[];
    hasMore: boolean;
    totalCount: number;
  }>(`/alerts${query ? `?${query}` : ''}`);
}

export async function updateAlert(id: string, data: { status?: string; assignedTo?: string }) {
  return apiRequest<Alert>(`/alerts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// Beneficial Owners
export async function getBeneficialOwners(customerId: string) {
  return apiRequest<{
    object: string;
    data: BeneficialOwner[];
    hasMore: boolean;
    totalCount: number;
  }>(`/beneficial-owners?customer_id=${customerId}`);
}

export async function createBeneficialOwner(data: BeneficialOwnerCreateInput) {
  return apiRequest<BeneficialOwner>('/beneficial-owners', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Business Customers
export async function getBusinessCustomers(params?: {
  limit?: number;
  riskLevel?: string;
  verificationStatus?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.riskLevel) searchParams.set('risk_level', params.riskLevel);
  if (params?.verificationStatus) searchParams.set('verification_status', params.verificationStatus);

  const query = searchParams.toString();
  return apiRequest<BusinessCustomerListResponse>(`/business${query ? `?${query}` : ''}`);
}

export async function getBusinessCustomer(id: string) {
  return apiRequest<BusinessCustomer>(`/business/${id}`);
}

export async function registerBusiness(data: BusinessCustomerCreateInput) {
  return apiRequest<BusinessCustomerWithRisk>('/business/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateBusinessCustomer(id: string, data: Partial<BusinessCustomerUpdateInput>) {
  return apiRequest<BusinessCustomer>(`/business/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// Business Beneficial Owners
export async function getBusinessOwners(businessId: string) {
  return apiRequest<BusinessBeneficialOwnerListResponse>(`/business/${businessId}/owners`);
}

export async function createBusinessOwner(businessId: string, data: BusinessBeneficialOwnerCreateInput) {
  return apiRequest<BusinessBeneficialOwner>(`/business/${businessId}/owners`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateBusinessOwner(businessId: string, ownerId: string, data: Partial<BusinessBeneficialOwnerUpdateInput>) {
  return apiRequest<BusinessBeneficialOwner>(`/business/${businessId}/owners/${ownerId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteBusinessOwner(businessId: string, ownerId: string) {
  return apiRequest<{ deleted: boolean; id: string }>(`/business/${businessId}/owners/${ownerId}`, {
    method: 'DELETE',
  });
}

// Sanctions Screening
export async function screenSanctions(data: { firstName: string; lastName: string; dateOfBirth?: string; country?: string }) {
  return apiRequest<ScreeningResult>('/sanctions/screen', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// PEP Screening
export async function screenPep(data: { firstName: string; lastName: string; country?: string }) {
  return apiRequest<ScreeningResult>('/pep/screen', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Analytics
export async function getAnalytics() {
  return apiRequest<AnalyticsOverview>('/analytics/overview');
}

// Regional Config
export async function getRegionalConfig(region?: string) {
  const query = region ? `?region=${region}` : '';
  return apiRequest<ConfigResponse>(`/config/regions${query}`);
}

// Identity Verifications (KYC)
export async function getVerifications(params?: { status?: string; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.status) searchParams.set('status', params.status);

  const query = searchParams.toString();
  return apiRequest<{
    object: string;
    data: IdentityVerification[];
    hasMore: boolean;
    totalCount: number;
  }>(`/identity-verifications${query ? `?${query}` : ''}`);
}

export async function reviewVerification(id: string, data: { decision: 'approve' | 'reject'; notes?: string }) {
  return apiRequest<IdentityVerification>(`/identity-verifications/${id}/review`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Webhooks
export async function getWebhooks() {
  return apiRequest<{
    object: string;
    data: Webhook[];
    hasMore: boolean;
  }>('/webhooks');
}

export async function createWebhook(data: { url: string; events: string[]; description?: string }) {
  return apiRequest<Webhook>('/webhooks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteWebhook(id: string) {
  return apiRequest<{ deleted: boolean }>(`/webhooks/${id}`, {
    method: 'DELETE',
  });
}

// Audit Logs
export async function getAuditLogs(params?: { limit?: number; entityType?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.entityType) searchParams.set('entity_type', params.entityType);

  const query = searchParams.toString();
  return apiRequest<{
    object: string;
    data: AuditLog[];
    hasMore: boolean;
  }>(`/audit-logs${query ? `?${query}` : ''}`);
}

// Reports
export async function generateTtrReport(params: { startDate: string; endDate: string; format?: string }) {
  const searchParams = new URLSearchParams();
  searchParams.set('start_date', params.startDate);
  searchParams.set('end_date', params.endDate);
  if (params.format) searchParams.set('format', params.format);

  return apiRequest<TtrReport>(`/reports/ttr?${searchParams.toString()}`);
}

// Types (simplified for dashboard use)
export interface Customer {
  id: string;
  email: string;
  customerType: 'individual' | 'business';
  firstName?: string;
  lastName?: string;
  companyName?: string;
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  isPep: boolean;
  isSanctioned: boolean;
  requiresEdd: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerCreateInput {
  email: string;
  customerType?: 'individual' | 'business';
  firstName?: string;
  lastName?: string;
  companyName?: string;
  dateOfBirth?: string;
  phone?: string;
}

export interface Transaction {
  id: string;
  customerId: string;
  amount: number;
  currency: string;
  direction: 'incoming' | 'outgoing';
  transactionType: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  flaggedForReview: boolean;
  requiresTtr: boolean;
  createdAt: string;
}

export interface Case {
  id: string;
  caseNumber: string;
  title: string;
  description?: string;
  caseType: string;
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'critical';
  status: string;
  customerId?: string;
  assignedTo?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaseCreateInput {
  title: string;
  caseType: string;
  priority?: string;
  customerId?: string;
  description?: string;
}

export interface CaseUpdateInput {
  status?: string;
  priority?: string;
  assignedTo?: string;
  resolutionNotes?: string;
}

export interface Alert {
  id: string;
  alertNumber: string;
  title: string;
  description?: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  status: string;
  entityType: string;
  entityId: string;
  customerId?: string;
  createdAt: string;
}

export interface BeneficialOwner {
  id: string;
  customerId: string;
  firstName: string;
  lastName: string;
  ownershipPercentage: number;
  verificationStatus: string;
  isPep: boolean;
  isSanctioned: boolean;
  createdAt: string;
}

export interface BeneficialOwnerCreateInput {
  customerId: string;
  firstName: string;
  lastName: string;
  ownershipPercentage: number;
  dateOfBirth?: string;
}

export interface ScreeningResult {
  isMatch: boolean;
  matchScore: number;
  status: string;
  matches: Array<{
    name: string;
    matchScore: number;
    source: string;
  }>;
}

export interface AnalyticsOverview {
  totalCustomers: number;
  verifiedCustomers: number;
  pendingVerifications: number;
  highRiskCustomers: number;
  totalTransactions: number;
  flaggedTransactions: number;
  openCases: number;
  openAlerts: number;
}

export interface ConfigResponse {
  availableRegions: Array<{ code: string; name: string; currency: string; regulator: string }>;
  currentRegion: string;
  currentConfig: {
    thresholds: {
      ttrRequired: number;
      kycRequired: number;
      enhancedDdRequired: number;
    };
    currency: string;
    currencySymbol: string;
    regulator: string;
    regulatorFullName: string;
  };
}

export interface IdentityVerification {
  id: string;
  customerId: string;
  provider: string;
  status: string;
  verifiedFirstName?: string;
  verifiedLastName?: string;
  documentType?: string;
  createdAt: string;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  status: string;
  description?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actionType: string;
  entityType: string;
  entityId: string;
  description: string;
  createdAt: string;
}

export interface TtrReport {
  reportId: string;
  startDate: string;
  endDate: string;
  transactionCount: number;
  totalAmount: number;
  data: unknown[];
}

// Business Customer Types
export type EntityType = 'company' | 'sole_trader' | 'partnership' | 'trust' | 'smsf';

export type BusinessOwnershipType = 'direct' | 'indirect' | 'control_person';

export interface BusinessCustomer {
  id: string;
  object: 'business_customer';
  primaryContactCustomerId: string;
  abn: string;
  acn?: string;
  businessName: string;
  tradingName?: string;
  entityType: EntityType;
  abrVerified: boolean;
  abrVerifiedAt?: string;
  gstRegistered: boolean;
  entityStatus: string;
  mainBusinessLocation?: {
    state: string;
    postcode: string;
  };
  industryCode?: string;
  industryDescription?: string;
  verificationStatus: 'pending' | 'verified' | 'rejected' | 'requires_review';
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  uboVerificationComplete: boolean;
  requiresEnhancedDd: boolean;
  eddCompleted: boolean;
  monitoringLevel: 'standard' | 'ongoing_review' | 'enhanced' | 'blocked';
  createdAt: string;
  updatedAt: string;
}

export interface BusinessCustomerWithRisk extends BusinessCustomer {
  riskAssessment: {
    score: number;
    level: 'low' | 'medium' | 'high';
    blocked: boolean;
    blockReason?: string;
    requiresEdd: boolean;
  };
}

export interface BusinessBeneficialOwner {
  id: string;
  object: 'business_beneficial_owner';
  businessCustomerId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  email?: string;
  phone?: string;
  ownershipPercentage: number;
  ownershipType: BusinessOwnershipType;
  role?: string;
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
  verificationLevel: 'none' | 'manual' | 'stripe_identity' | 'dvs_verified';
  isPep: boolean;
  pepRelationship?: string;
  isSanctioned: boolean;
  lastScreeningAt?: string;
  lastVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessCustomerCreateInput {
  primaryContactCustomerId: string;
  entityType: EntityType;
  abn: string;
  acn?: string;
  businessName: string;
  tradingName?: string;
  abrResponse?: {
    abnStatus: 'Active' | 'Cancelled' | 'Deleted';
    gstRegistered: boolean;
    gstRegisteredDate?: string;
    mainBusinessLocation?: {
      state: string;
      postcode: string;
    };
  };
  registeredAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  principalAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  industryCode?: string;
  industryDescription?: string;
}

export interface BusinessCustomerUpdateInput {
  businessName?: string;
  tradingName?: string;
  verificationStatus?: 'pending' | 'verified' | 'rejected' | 'requires_review';
  verificationNotes?: string;
  uboVerificationComplete?: boolean;
  requiresEnhancedDd?: boolean;
  eddCompleted?: boolean;
  monitoringLevel?: 'standard' | 'ongoing_review' | 'enhanced' | 'blocked';
}

export interface BusinessBeneficialOwnerCreateInput {
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  email?: string;
  phone?: string;
  residentialAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  ownershipPercentage: number;
  ownershipType: BusinessOwnershipType;
  role?: string;
}

export interface BusinessBeneficialOwnerUpdateInput {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
  email?: string;
  phone?: string;
  ownershipPercentage?: number;
  ownershipType?: BusinessOwnershipType;
  role?: string;
  verificationStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';
  verificationLevel?: 'none' | 'manual' | 'stripe_identity' | 'dvs_verified';
  isPep?: boolean;
  pepRelationship?: string;
  isSanctioned?: boolean;
}

export interface BusinessCustomerListResponse {
  object: 'list';
  data: BusinessCustomer[];
  hasMore: boolean;
  totalCount: number;
}

export interface BusinessBeneficialOwnerListResponse {
  object: 'list';
  data: BusinessBeneficialOwner[];
}
