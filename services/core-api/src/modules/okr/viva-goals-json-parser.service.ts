import { Injectable } from '@nestjs/common';

/**
 * Viva Goals JSON Export Parser Service
 * 
 * Parses JSON export files from Viva Goals and converts them to a format
 * compatible with the OKR import system.
 */

export interface VivaGoalsUser {
  ID: number;
  Name: string;
  Email: string;
  Manager?: {
    ID: number;
    Name: string;
    Email: string;
  } | null;
  Teams?: Array<{
    ID: number;
    Name: string;
  }>;
  'Last Active'?: string | null;
  Role?: string;
  Source?: string;
  'Member Type'?: string;
  Status?: string;
}

export interface VivaGoalsTeam {
  ID: number;
  'Team Name': string;
  'Parent Team'?: string | null;
  'Team Owners'?: Array<{
    ID: number;
    Name: string;
    Email: string;
  }>;
  'Team Type'?: string;
  Status?: string;
  Description?: string | null;
}

export interface VivaGoalsTimePeriod {
  ID: number;
  'Time Period Name': string;
  'Start Date': string;
  'End Date': string;
}

export interface VivaGoalsTag {
  ID: number;
  'Tag Name': string;
}

export interface VivaGoalsComment {
  ID: number;
  'OKR ID': number;
  Comment: string;
  'Created By': {
    ID: number;
    Name: string;
    Email: string;
  };
  'Created At': string;
}

export interface VivaGoalsCheckIn {
  ID: number;
  'OKR ID': number;
  'CheckIn Date': string;
  'Check In Owner': {
    ID: number;
    Name: string;
    Email: string;
  };
  'Check In Note'?: Record<string, any> | null;
  'Metric Name'?: string;
  Status?: string;
  'Current Value'?: number;
  'Activity Date'?: string;
}

export interface VivaGoalsObjective {
  ID: number;
  Title: string;
  Type: 'Objective' | 'Key result' | 'Deliverable';
  'Created By'?: {
    ID: number;
    Name: string;
    Email: string;
  } | null;
  Owner?: Array<{
    ID: number;
    Name: string;
    Email: string;
  }> | null;
  Teams?: Array<{
    ID: number;
    Name: string;
  }> | null;
  'Time Period'?: {
    ID: number;
    Name: string;
  } | null;
  'Start Date'?: string;
  'End Date'?: string;
  Alignment?: Array<{
    ID: number;
    Title: string;
    Weight: string;
  }> | null;
  'Delegated To'?: any;
  Permissions?: Record<string, any>;
  Description?: string | null;
  Tags?: Array<{
    ID: number;
    'Tag Name': string;
  }> | null;
  'Progress and Status Configuration'?: Record<string, any>;
  Progress?: number;
  Status?: string;
  Outcome?: {
    'Outcome Type'?: string;
    'Metric Name'?: string;
    'Metric Unit'?: string;
    Start?: number;
    Target?: number;
    'Target Type'?: string;
  };
  'Phased Targets'?: string | Array<{
    'Target Value': number;
    'Target Date': string;
  }>;
  'Check-in Owners'?: Array<{
    ID: number;
    Name: string;
    Email: string;
  }>;
  'Parent IDs'?: number[] | null;
  Children?: Array<{
    ID: number;
    Title: string;
    Type: string;
  }>;
  Score?: number;
  'Goal Type'?: string;
  'Created At'?: string;
  'Last Check-in'?: string;
  // Key Result specific fields
  'Metric Name'?: string;
  Unit?: string;
  Target?: number | string;
  Start?: number | string;
  'Actual Progress'?: number;
  'Progress %'?: number;
}

export interface ParsedVivaGoalsJSONRow {
  externalId: string;
  title: string;
  type: 'Objective' | 'Key result' | 'Deliverable';
  creator?: {
    id: number;
    name: string;
    email: string;
  } | null;
  owners: Array<{
    id: number;
    name: string;
    email: string;
  }>;
  teams: Array<{
    id: number;
    name: string;
  }>;
  timePeriod?: {
    id: number;
    name: string;
  } | null;
  startDate: string | null;
  endDate: string | null;
  alignment?: Array<{
    id: number;
    title: string;
    weight: number; // Parsed from percentage string
  }> | null;
  description: string | null;
  tags: Array<number> | null; // Tag IDs
  progress: number | null;
  status: string | null;
  goalType: string | null;
  createdAt: string | null;
  lastCheckin: string | null;
  parentIds: number[] | null;
  children: Array<{
    id: number;
    title: string;
    type: string;
  }> | null;
  // Key Result specific
  metricName?: string | null;
  unit?: string | null;
  target?: number | null;
  start?: number | null;
  actualProgress?: number | null;
  progressPercent?: number | null;
  targetType?: string | null; // VivaGoals Target Type (e.g., "Reach", "Increase From")
  
  // NEW: Additional Viva Goals fields for metadata storage
  phasedTargets?: {
    interval: string; // "monthly" | "quarterly" | "custom"
    targets: Array<{
      targetValue: number;
      targetDate: string;
    }>;
  } | null;
  
  delegatedTo?: {
    id: number;
    name: string;
    email: string;
  } | null;
  
  checkInOwners?: Array<{
    id: number;
    name: string;
    email: string;
  }> | null;
  
  permissions?: {
    view: string; // "Everybody" | "Team Members" | "Owner Only" | "Custom"
    edit: Record<string, any>; // Empty = owner only
    align: string;
  } | null;
  
  progressConfig?: {
    progress: string; // "Update from Children" | "Update Manually"
    status: string; // "Update based on Progress" | "Update Manually"
    dataSource: string | null;
  } | null;
  
  score?: number | null;
  
  // For Key Results
  outcome?: {
    outcomeType: string; // "Metric" | "Percentage"
    metricName?: string;
    metricUnit?: string;
    start?: number;
    target?: number;
    targetType?: string; // "Increase From" | "Decrease From" | "Reach"
  } | null;
}

@Injectable()
export class VivaGoalsJSONParserService {
  /**
   * Parse Users JSON export
   */
  parseUsers(jsonContent: string): VivaGoalsUser[] {
    try {
      return JSON.parse(jsonContent);
    } catch (error) {
      throw new Error(`Failed to parse users JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse Teams JSON export
   */
  parseTeams(jsonContent: string): VivaGoalsTeam[] {
    try {
      return JSON.parse(jsonContent);
    } catch (error) {
      throw new Error(`Failed to parse teams JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse Time Periods JSON export
   */
  parseTimePeriods(jsonContent: string): VivaGoalsTimePeriod[] {
    try {
      return JSON.parse(jsonContent);
    } catch (error) {
      throw new Error(`Failed to parse time periods JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse Tags JSON export
   */
  parseTags(jsonContent: string): VivaGoalsTag[] {
    try {
      return JSON.parse(jsonContent);
    } catch (error) {
      throw new Error(`Failed to parse tags JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse Comments JSON export
   */
  parseComments(jsonContent: string): VivaGoalsComment[] {
    try {
      return JSON.parse(jsonContent);
    } catch (error) {
      throw new Error(`Failed to parse comments JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse Check-ins JSON export
   */
  parseCheckIns(jsonContent: string): VivaGoalsCheckIn[] {
    try {
      return JSON.parse(jsonContent);
    } catch (error) {
      throw new Error(`Failed to parse check-ins JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse Objectives JSON export and convert to ParsedVivaGoalsJSONRow format
   */
  parseObjectives(jsonContent: string): ParsedVivaGoalsJSONRow[] {
    try {
      const objectives: VivaGoalsObjective[] = JSON.parse(jsonContent);
      return objectives.map(obj => this.parseObjectiveRow(obj));
    } catch (error) {
      throw new Error(`Failed to parse objectives JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse a single objective row
   */
  private parseObjectiveRow(obj: VivaGoalsObjective): ParsedVivaGoalsJSONRow {
    // Parse weight from alignment (e.g., "0.0%" -> 0.0)
    const alignment = obj.Alignment?.map(a => ({
      id: a.ID,
      title: a.Title,
      weight: this.parseWeight(a.Weight),
    })) || null;

    // Extract parent IDs from alignment or Parent IDs field
    const parentIds = obj['Parent IDs'] || (alignment ? alignment.map(a => a.id) : null);

    return {
      externalId: String(obj.ID),
      title: obj.Title,
      type: obj.Type === 'Key result' ? 'Key result' : obj.Type === 'Deliverable' ? 'Deliverable' : 'Objective',
      creator: obj['Created By'] ? {
        id: obj['Created By'].ID,
        name: obj['Created By'].Name,
        email: obj['Created By'].Email,
      } : null,
      owners: obj.Owner?.map(o => ({
        id: o.ID,
        name: o.Name,
        email: o.Email,
      })) || [],
      teams: obj.Teams?.map(t => ({
        id: t.ID,
        name: t.Name,
      })) || [],
      timePeriod: obj['Time Period'] ? {
        id: obj['Time Period'].ID,
        name: obj['Time Period'].Name,
      } : null,
      startDate: obj['Start Date'] || null,
      endDate: obj['End Date'] || null,
      alignment,
      description: obj.Description || null,
      tags: obj.Tags?.map(t => t.ID) || null,
      progress: obj.Progress ?? null,
      status: obj.Status || null,
      goalType: obj['Goal Type'] || null,
      createdAt: obj['Created At'] || null,
      lastCheckin: obj['Last Check-in'] || null,
      parentIds,
      children: obj.Children?.map(c => ({
        id: c.ID,
        title: c.Title,
        type: c.Type,
      })) || null,
      // Key Result specific fields
      // Extract from Outcome object if it exists (for JSON format)
      // Otherwise fall back to top-level fields (for backward compatibility)
      metricName: obj.Outcome?.['Metric Name'] || obj['Metric Name'] || null,
      unit: obj.Outcome?.['Metric Unit'] || obj.Unit || null,
      target: this.parseNumber(obj.Outcome?.Target ?? obj.Target),
      start: this.parseNumber(obj.Outcome?.Start ?? obj.Start),
      actualProgress: obj['Actual Progress'] ?? null,
      progressPercent: obj['Progress %'] ?? null,
      // Store target type for metric type inference
      targetType: obj.Outcome?.['Target Type'] || null,
      
      // NEW: Parse additional Viva Goals fields for metadata storage
      // Parse Phased Targets
      phasedTargets: this.parsePhasedTargets(obj['Phased Targets']),
      
      // Parse Delegated To
      delegatedTo: this.parseDelegatedTo(obj['Delegated To']),
      
      // Parse Check-in Owners
      checkInOwners: obj['Check-in Owners']?.map(co => ({
        id: co.ID,
        name: co.Name,
        email: co.Email,
      })) || null,
      
      // Parse Permissions
      permissions: obj.Permissions ? {
        view: obj.Permissions.View || 'Everybody',
        edit: obj.Permissions.Edit || {},
        align: obj.Permissions.Align || 'Everybody',
      } : null,
      
      // Parse Progress and Status Configuration
      progressConfig: obj['Progress and Status Configuration'] ? {
        progress: obj['Progress and Status Configuration'].Progress || 'Update from Children',
        status: obj['Progress and Status Configuration'].Status || 'Update based on Progress',
        dataSource: obj['Progress and Status Configuration']['Data Source'] || null,
      } : null,
      
      // Parse Score
      score: obj.Score ?? null,
      
      // Parse Outcome (for Key Results)
      outcome: obj.Outcome ? {
        outcomeType: obj.Outcome['Outcome Type'] || 'Metric',
        metricName: obj.Outcome['Metric Name'],
        metricUnit: obj.Outcome['Metric Unit'],
        start: obj.Outcome.Start,
        target: obj.Outcome.Target,
        targetType: obj.Outcome['Target Type'],
      } : null,
    };
  }
  
  /**
   * Parse Phased Targets from Viva Goals format
   */
  private parsePhasedTargets(phasedTargets: string | Array<{ 'Target Value': number; 'Target Date': string }> | undefined): {
    interval: string;
    targets: Array<{ targetValue: number; targetDate: string }>;
  } | null {
    if (!phasedTargets || phasedTargets === 'Disabled' || typeof phasedTargets === 'string') {
      return null;
    }
    
    if (Array.isArray(phasedTargets)) {
      // If it's just an array, assume monthly interval
      return {
        interval: 'monthly',
        targets: phasedTargets.map(t => ({
          targetValue: t['Target Value'],
          targetDate: t['Target Date'],
        })),
      };
    }
    
    // If it's an object with Interval and Phased Targets
    if (typeof phasedTargets === 'object' && 'Interval' in phasedTargets) {
      const pt = phasedTargets as any;
      if (pt['Phased Targets'] && Array.isArray(pt['Phased Targets'])) {
        return {
          interval: pt.Interval?.toLowerCase() || 'monthly',
          targets: pt['Phased Targets'].map((t: any) => ({
            targetValue: t['Target Value'],
            targetDate: t['Target Date'],
          })),
        };
      }
    }
    
    return null;
  }
  
  /**
   * Parse Delegated To from Viva Goals format
   */
  private parseDelegatedTo(delegatedTo: any): { id: number; name: string; email: string } | null {
    if (!delegatedTo || typeof delegatedTo !== 'object') {
      return null;
    }
    
    if (delegatedTo.ID && delegatedTo.Name && delegatedTo.Email) {
      return {
        id: delegatedTo.ID,
        name: delegatedTo.Name,
        email: delegatedTo.Email,
      };
    }
    
    return null;
  }

  /**
   * Parse weight string (e.g., "0.0%" -> 0.0)
   */
  private parseWeight(weightStr: string | undefined): number {
    if (!weightStr) return 0;
    const match = weightStr.match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : 0;
  }

  /**
   * Parse number from string or number
   */
  private parseNumber(value: string | number | undefined | null): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? null : parsed;
  }
}

