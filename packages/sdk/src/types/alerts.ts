export type AlertRuleType =
  | 'transaction_amount'
  | 'transaction_velocity'
  | 'transaction_pattern'
  | 'structuring'
  | 'high_risk_country'
  | 'pep_detection'
  | 'sanctions_match'
  | 'kyc_expiry'
  | 'document_expiry'
  | 'risk_score_change'
  | 'unusual_activity'
  | 'dormant_account'
  | 'new_payee'
  | 'cross_border'
  | 'custom';

export type AlertSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type AlertStatus =
  | 'new'
  | 'acknowledged'
  | 'investigating'
  | 'escalated'
  | 'resolved'
  | 'dismissed'
  | 'false_positive';

export type AlertResolutionType =
  | 'legitimate'
  | 'false_positive'
  | 'case_created'
  | 'smr_filed'
  | 'no_action'
  | 'escalated'
  | 'other';

export interface NotificationRecipient {
  type: 'email' | 'webhook' | 'sms';
  value: string;
}

export interface AlertRule {
  id: string;
  object: 'alert_rule';
  ruleName: string;
  ruleCode: string;
  description?: string;
  ruleType: AlertRuleType;
  entityType: 'customer' | 'transaction' | 'document' | 'screening';

  // Rule conditions (flexible JSON)
  conditions: Record<string, unknown>;

  // Severity & Actions
  severity: AlertSeverity;
  autoCreateCase: boolean;
  caseType?: string;
  casePriority?: string;

  // Notifications
  notificationChannels: string[];
  notificationRecipients: NotificationRecipient[];

  // Rate Limiting
  cooldownMinutes: number;
  maxAlertsPerDay: number;

  // Status
  isEnabled: boolean;
  isSystemRule: boolean;

  // Jurisdictions
  jurisdictions: string[];

  createdBy?: string;
  updatedBy?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationSent {
  channel: string;
  recipient: string;
  sentAt: string;
  status: 'sent' | 'failed';
}

export interface Alert {
  id: string;
  object: 'alert';
  alertNumber: string;
  alertRuleId?: string;
  title: string;
  description?: string;
  severity: AlertSeverity;

  // Entity that triggered the alert
  entityType: 'customer' | 'transaction' | 'document' | 'screening';
  entityId: string;
  customerId?: string;

  // What triggered the alert
  triggerData: Record<string, unknown>;

  // Status
  status: AlertStatus;

  // Acknowledgment
  acknowledgedBy?: string;
  acknowledgedAt?: string;

  // Assignment
  assignedTo?: string;
  assignedAt?: string;

  // Investigation
  investigationNotes?: string;

  // Resolution
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionType?: AlertResolutionType;
  resolutionNotes?: string;

  // Escalation
  isEscalated: boolean;
  escalatedTo?: string;
  escalationReason?: string;
  escalatedAt?: string;

  // Linked Case
  caseId?: string;

  // Notifications
  notificationsSent: NotificationSent[];

  // SLA
  slaDeadline?: string;
  slaBreached: boolean;

  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AlertRuleCreateInput {
  ruleName: string;
  ruleCode: string;
  description?: string;
  ruleType: AlertRuleType;
  entityType: 'customer' | 'transaction' | 'document' | 'screening';
  conditions: Record<string, unknown>;
  severity: AlertSeverity;
  autoCreateCase?: boolean;
  caseType?: string;
  casePriority?: string;
  notificationChannels?: string[];
  notificationRecipients?: NotificationRecipient[];
  cooldownMinutes?: number;
  maxAlertsPerDay?: number;
  isEnabled?: boolean;
  jurisdictions?: string[];
  metadata?: Record<string, unknown>;
}

export interface AlertRuleUpdateInput {
  ruleName?: string;
  description?: string;
  conditions?: Record<string, unknown>;
  severity?: AlertSeverity;
  autoCreateCase?: boolean;
  caseType?: string;
  casePriority?: string;
  notificationChannels?: string[];
  notificationRecipients?: NotificationRecipient[];
  cooldownMinutes?: number;
  maxAlertsPerDay?: number;
  isEnabled?: boolean;
  jurisdictions?: string[];
  metadata?: Record<string, unknown>;
}

export interface AlertUpdateInput {
  status?: AlertStatus;
  assignedTo?: string;
  investigationNotes?: string;
  resolutionType?: AlertResolutionType;
  resolutionNotes?: string;
  metadata?: Record<string, unknown>;
}

export interface AlertRuleListParams {
  ruleType?: AlertRuleType;
  entityType?: string;
  isEnabled?: boolean;
  limit?: number;
  startingAfter?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface AlertListParams {
  status?: AlertStatus;
  severity?: AlertSeverity;
  entityType?: string;
  customerId?: string;
  alertRuleId?: string;
  assignedTo?: string;
  isEscalated?: boolean;
  limit?: number;
  startingAfter?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface AlertRuleListResponse {
  object: 'list';
  data: AlertRule[];
  hasMore: boolean;
  totalCount: number;
}

export interface AlertListResponse {
  object: 'list';
  data: Alert[];
  hasMore: boolean;
  totalCount: number;
}
