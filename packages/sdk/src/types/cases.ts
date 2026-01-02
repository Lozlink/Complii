export type CaseType =
  | 'investigation'
  | 'alert_review'
  | 'kyc_review'
  | 'edd_review'
  | 'ocdd_review'
  | 'sanctions_hit'
  | 'pep_review'
  | 'transaction_review'
  | 'smr_preparation'
  | 'complaint'
  | 'regulatory_inquiry'
  | 'other';

export type CasePriority = 'low' | 'medium' | 'high' | 'urgent' | 'critical';

export type CaseStatus =
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'pending_info'
  | 'under_review'
  | 'escalated'
  | 'resolved'
  | 'closed'
  | 'reopened';

export type ResolutionType =
  | 'no_action_required'
  | 'false_positive'
  | 'legitimate_activity'
  | 'smr_filed'
  | 'account_closed'
  | 'enhanced_monitoring'
  | 'referred_to_law_enforcement'
  | 'other';

export interface CaseDocument {
  documentId: string;
  fileName: string;
  description?: string;
  uploadedAt: string;
}

export interface Case {
  id: string;
  object: 'case';
  caseNumber: string;
  title: string;
  description?: string;
  caseType: CaseType;
  priority: CasePriority;
  status: CaseStatus;

  // Linked entities
  customerId?: string;
  transactionIds?: string[];
  smrReportId?: string;
  iftiReportId?: string;
  alertId?: string;

  // Assignment
  assignedTo?: string;
  assignedAt?: string;
  assignedBy?: string;
  department?: string;

  // Timeline
  dueDate?: string;
  slaDeadline?: string;

  // Escalation
  isEscalated: boolean;
  escalatedTo?: string;
  escalationReason?: string;
  escalatedAt?: string;
  escalationLevel: number;

  // Resolution
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionType?: ResolutionType;
  resolutionSummary?: string;
  resolutionNotes?: string;

  // Risk
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';

  // Closure
  closedAt?: string;
  closedBy?: string;
  closureReason?: string;

  // Documents
  documents?: CaseDocument[];
  tags?: string[];

  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type TaskType =
  | 'document_review'
  | 'customer_contact'
  | 'verification'
  | 'screening'
  | 'investigation'
  | 'report_preparation'
  | 'approval'
  | 'communication'
  | 'follow_up'
  | 'other';

export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'cancelled'
  | 'deferred';

export type TaskResult =
  | 'passed'
  | 'failed'
  | 'inconclusive'
  | 'requires_escalation'
  | 'not_applicable';

export interface CaseTask {
  id: string;
  object: 'case_task';
  caseId: string;
  title: string;
  description?: string;
  taskType: TaskType;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';

  // Assignment
  assignedTo?: string;
  assignedAt?: string;

  // Timeline
  dueDate?: string;
  completedAt?: string;
  completedBy?: string;

  // Result
  result?: TaskResult;
  resultNotes?: string;

  // Ordering
  taskOrder: number;
  dependsOn?: string[];

  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CaseCreateInput {
  title: string;
  description?: string;
  caseType: CaseType;
  priority?: CasePriority;
  customerId?: string;
  transactionIds?: string[];
  assignedTo?: string;
  department?: string;
  dueDate?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface CaseUpdateInput {
  title?: string;
  description?: string;
  priority?: CasePriority;
  status?: CaseStatus;
  assignedTo?: string;
  department?: string;
  dueDate?: string;
  resolutionType?: ResolutionType;
  resolutionSummary?: string;
  resolutionNotes?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface CaseTaskCreateInput {
  caseId: string;
  title: string;
  description?: string;
  taskType: TaskType;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  dueDate?: string;
  taskOrder?: number;
  dependsOn?: string[];
  metadata?: Record<string, unknown>;
}

export interface CaseTaskUpdateInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  dueDate?: string;
  result?: TaskResult;
  resultNotes?: string;
  metadata?: Record<string, unknown>;
}

export interface CaseListParams {
  status?: CaseStatus;
  caseType?: CaseType;
  priority?: CasePriority;
  customerId?: string;
  assignedTo?: string;
  isEscalated?: boolean;
  limit?: number;
  startingAfter?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface CaseListResponse {
  object: 'list';
  data: Case[];
  hasMore: boolean;
  totalCount: number;
}

export interface CaseTaskListResponse {
  object: 'list';
  data: CaseTask[];
  hasMore: boolean;
  totalCount: number;
}
