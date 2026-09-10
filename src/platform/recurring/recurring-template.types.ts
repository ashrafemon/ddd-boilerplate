export type RecurringTemplateStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'COMPLETED';
export type RecurringTriggerType = 'TIME' | 'EVENT';
export type RecurringFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type RecurringPartyType = 'CUSTOMER' | 'VENDOR' | 'EMPLOYEE';
export type RecurringExecutionStatus = 'IN_PROGRESS' | 'SUCCESS' | 'FAILED' | 'SKIPPED';

export interface RecurringTemplateRecord {
  id: string;
  tenantId: string | null;
  templateNo: string;
  name: string;
  status: RecurringTemplateStatus;
  targetEntityType: string;
  targetEntityId: string | null;
  originDocumentType: string | null;
  originDocumentId: string | null;
  partyId: string | null;
  partyType: RecurringPartyType | null;
  currency: string;
  triggerType: RecurringTriggerType;
  eventName: string | null;
  frequency: RecurringFrequency | null;
  interval: number | null;
  startDate: Date | null;
  endDate: Date | null;
  nextRunDate: Date | null;
  lastRunDate: Date | null;
  timeZone: string;
  autoPost: boolean;
  autoEmail: boolean;
  autoApprove: boolean;
  headerOverrides: Record<string, unknown> | null;
  generationCondition: Record<string, unknown> | null;
  lines: unknown[];
}

export interface CreateRecurringTemplateInput {
  tenantId?: string;
  templateNo: string;
  name: string;
  targetEntityType: string;
  targetEntityId?: string;
  originDocumentType?: string;
  originDocumentId?: string;
  partyId?: string;
  partyType?: RecurringPartyType;
  currency: string;
  triggerType: RecurringTriggerType;
  eventName?: string;
  frequency?: RecurringFrequency;
  interval?: number;
  startDate?: Date;
  endDate?: Date;
  timeZone?: string;
  autoPost?: boolean;
  autoEmail?: boolean;
  autoApprove?: boolean;
  headerOverrides?: Record<string, unknown>;
  generationCondition?: Record<string, unknown>;
  lines: unknown[];
  createdBy?: string;
}

export interface RecurringExecutionRecord {
  id: string;
  recurringTemplateId: string;
  scheduleJobId: string | null;
  runDate: Date | null;
  sourceEventId: string | null;
  triggerKey: string;
  generatedDocumentType: string;
  generatedDocumentId: string | null;
  generatedSnapshot: Record<string, unknown> | null;
  conditionEvaluation: Record<string, unknown> | null;
  status: RecurringExecutionStatus;
  skipReason: string | null;
  errorMessage: string | null;
}

export interface ClaimExecutionInput {
  tenantId?: string;
  recurringTemplateId: string;
  scheduleJobId?: string;
  runDate?: Date;
  sourceEventId?: string;
  triggerKey: string;
  generatedDocumentType: string;
}
