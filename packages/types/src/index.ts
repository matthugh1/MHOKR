// Shared TypeScript types and interfaces for OKR Nexus

// ==========================================
// User & Organization Types
// ==========================================

export enum MemberRole {
  ORG_ADMIN = 'ORG_ADMIN',
  WORKSPACE_OWNER = 'WORKSPACE_OWNER',
  TEAM_LEAD = 'TEAM_LEAD',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

export interface User {
  id: string;
  email: string;
  keycloakId: string;
  name: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Workspace {
  id: string;
  name: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Team {
  id: string;
  name: string;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMember {
  id: string;
  userId: string;
  teamId: string;
  role: MemberRole;
}

// ==========================================
// OKR Types
// ==========================================

export enum Period {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUAL = 'ANNUAL',
  CUSTOM = 'CUSTOM',
}

export enum OKRStatus {
  ON_TRACK = 'ON_TRACK',
  AT_RISK = 'AT_RISK',
  OFF_TRACK = 'OFF_TRACK',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum MetricType {
  INCREASE = 'INCREASE',
  DECREASE = 'DECREASE',
  REACH = 'REACH',
  MAINTAIN = 'MAINTAIN',
}

export enum InitiativeStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  BLOCKED = 'BLOCKED',
}

export interface Objective {
  id: string;
  title: string;
  description?: string;
  workspaceId: string;
  teamId?: string;
  ownerId: string;
  parentId?: string;
  period: Period;
  startDate: Date;
  endDate: Date;
  status: OKRStatus;
  progress: number;
  positionX?: number;
  positionY?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface KeyResult {
  id: string;
  title: string;
  description?: string;
  ownerId: string;
  metricType: MetricType;
  startValue: number;
  targetValue: number;
  currentValue: number;
  unit?: string;
  status: OKRStatus;
  progress: number;
  period?: Period;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Initiative {
  id: string;
  title: string;
  description?: string;
  keyResultId?: string;
  objectiveId?: string;
  ownerId: string;
  status: InitiativeStatus;
  period?: Period;
  startDate?: Date;
  endDate?: Date;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// Tracking & Activity Types
// ==========================================

export interface CheckIn {
  id: string;
  keyResultId: string;
  userId: string;
  value: number;
  confidence: number;
  note?: string;
  blockers?: string;
  createdAt: Date;
}

export enum EntityType {
  OBJECTIVE = 'OBJECTIVE',
  KEY_RESULT = 'KEY_RESULT',
  INITIATIVE = 'INITIATIVE',
  CHECK_IN = 'CHECK_IN',
}

export enum ActivityAction {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  DELETED = 'DELETED',
  COMPLETED = 'COMPLETED',
  ALIGNED = 'ALIGNED',
  COMMENTED = 'COMMENTED',
}

export interface Activity {
  id: string;
  entityType: EntityType;
  entityId: string;
  userId: string;
  action: ActivityAction;
  metadata?: Record<string, any>;
  createdAt: Date;
}

// ==========================================
// AI Types
// ==========================================

export enum AIPersona {
  OKR_COACH = 'OKR_COACH',
  CASCADE_ASSISTANT = 'CASCADE_ASSISTANT',
  PROGRESS_ANALYST = 'PROGRESS_ANALYST',
}

export interface AIConversation {
  id: string;
  userId: string;
  workspaceId: string;
  persona: AIPersona;
  context?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: Record<string, any>;
  createdAt: Date;
}

// ==========================================
// Integration Types
// ==========================================

export enum IntegrationSource {
  JIRA = 'JIRA',
  GITHUB = 'GITHUB',
  SALESFORCE = 'SALESFORCE',
  CUSTOM_WEBHOOK = 'CUSTOM_WEBHOOK',
}

export interface KRIntegration {
  id: string;
  keyResultId: string;
  source: IntegrationSource;
  externalId: string;
  config: Record<string, any>;
  lastSync?: Date;
  createdAt: Date;
}

// ==========================================
// API Request/Response Types
// ==========================================

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ==========================================
// Auth Types
// ==========================================

export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
}

export interface JWTPayload {
  sub: string;
  email: string;
  name: string;
  roles: MemberRole[];
  workspaceId?: string;
  teamId?: string;
  iat: number;
  exp: number;
}

