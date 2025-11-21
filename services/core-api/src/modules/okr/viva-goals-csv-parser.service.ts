import { Injectable } from '@nestjs/common';

export interface VivaGoalsCSVRow {
  Id: string;
  Title: string;
  Team: string;
  Creator: string;
  Owner: string;
  Period: string;
  'Start Date': string;
  'End Date': string;
  Description: string;
  'Aligned To (weight, Objective ID)': string;
  'Metric Name': string;
  Unit: string;
  Target: string;
  'Object Type': string;
  'Goal Type': string;
  Start: string;
  'Created At': string;
  'Last Check-in': string;
  'Progress %': string;
  'Actual Progress': string;
  Status: string;
  'Last Check-in Note': string;
  Score: string;
  Checkins: string;
}

export interface ParsedCheckIn {
  checkinDate: string; // "2025-03-10"
  user: string; // "Roland Green"
  note: string | null;
  status: string | null; // "On Track", "Behind", etc.
  currentValue: number | null; // Percentage or absolute value
  activityDate: string; // "2025-03-10 20:57:08 UTC"
}

export interface ParsedVivaGoalsRow {
  externalId: string;
  title: string;
  team: string | null;
  creator: string | null;
  owners: string[]; // Array of owner names (comma-separated in CSV)
  period: string;
  startDate: string;
  endDate: string;
  description: string | null;
  alignedTo: string | null; // Full "Aligned To" string
  parentTitle: string | null; // Extracted from Aligned To
  parentWeight: number | null; // Extracted weight percentage (0-100)
  parentExternalId: string | null; // Extracted parent ID
  metricName: string | null;
  unit: string | null;
  target: number | null;
  objectType: 'Objective' | 'Key result' | 'Deliverable';
  goalType: string;
  start: number | null;
  createdAt: string | null;
  lastCheckin: string | null;
  progress?: number | null; // Progress field from JSON (might be currentValue for Number/Dollar units)
  progressPercent: number | null;
  actualProgress: number | null;
  status: string;
  lastCheckinNote: string | null;
  score: number | null;
  checkins: ParsedCheckIn[]; // Parsed check-in history
  phasedTargets?: {
    interval: string; // "monthly" | "quarterly" | "custom"
    targets: Array<{
      targetValue: number;
      targetDate: string;
    }>;
  } | null;
}

@Injectable()
export class VivaGoalsCSVParserService {
  /**
   * Parse CSV content string into array of parsed rows
   */
  parseCSV(csvContent: string): ParsedVivaGoalsRow[] {
    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      return [];
    }

    // Parse header row
    const headers = this.parseCSVLine(lines[0]);
    const headerMap = new Map<string, number>();
    headers.forEach((header, index) => {
      headerMap.set(header.trim(), index);
    });

    // Parse data rows
    const rows: ParsedVivaGoalsRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === 0 || !values[0]?.trim()) {
        continue; // Skip empty rows
      }

      const row = this.parseRow(values, headerMap);
      if (row) {
        rows.push(row);
      }
    }

    return rows;
  }

  /**
   * Parse a CSV line handling quoted fields and commas
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    // Add last field
    result.push(current);
    return result;
  }

  /**
   * Parse a single row into ParsedVivaGoalsRow
   */
  private parseRow(values: string[], headerMap: Map<string, number>): ParsedVivaGoalsRow | null {
    const getValue = (header: string): string => {
      const index = headerMap.get(header);
      return index !== undefined && values[index] ? values[index].trim() : '';
    };

    // Try to get Id, or generate one from Title if Id column doesn't exist
    let externalId = getValue('Id');
    if (!externalId) {
      // If no Id column, generate one from Title (hash-based for consistency)
      const title = getValue('Title');
      if (!title) {
        return null; // Skip rows without Title
      }
      // Generate a simple hash-based ID from title
      externalId = `gen_${title.split('').reduce((acc, char) => {
        const hash = ((acc << 5) - acc) + char.charCodeAt(0);
        return hash & hash;
      }, 0).toString(36)}`;
    }

    // Parse "Aligned To" column to extract parent info
    const alignedTo = getValue('Aligned To (weight, Objective ID)');
    const { parentTitle, parentWeight, parentExternalId } = this.parseAlignedTo(alignedTo);

    // Parse owners (comma-separated)
    const ownerStr = getValue('Owner');
    const owners = ownerStr
      ? ownerStr.split(',').map(o => o.trim()).filter(o => o.length > 0)
      : [];

    // Parse numeric values
    const target = this.parseNumber(getValue('Target'));
    const start = this.parseNumber(getValue('Start'));
    const progressPercent = this.parseNumber(getValue('Progress %'));
    const actualProgress = this.parseNumber(getValue('Actual Progress'));
    const score = this.parseNumber(getValue('Score'));

    // Parse object type
    const objectTypeStr = getValue('Object Type');
    const objectType = this.parseObjectType(objectTypeStr);

    // Parse check-ins
    const checkinsStr = getValue('Checkins');
    const checkins = this.parseCheckins(checkinsStr);

    return {
      externalId,
      title: getValue('Title'),
      team: getValue('Team') || null,
      creator: getValue('Creator') || null,
      owners,
      period: getValue('Period'),
      startDate: getValue('Start Date'),
      endDate: getValue('End Date'),
      description: getValue('Description') || null,
      alignedTo: alignedTo || null,
      parentTitle,
      parentWeight,
      parentExternalId,
      metricName: getValue('Metric Name') || null,
      unit: getValue('Unit') || null,
      target,
      objectType,
      goalType: getValue('Goal Type'),
      start,
      createdAt: getValue('Created At') || null,
      lastCheckin: getValue('Last Check-in') || null,
      progressPercent,
      actualProgress,
      status: getValue('Status'),
      lastCheckinNote: getValue('Last Check-in Note') || null,
      score,
      checkins,
    };
  }

  /**
   * Parse "Aligned To" column format: "Title(weight: X%, Id: Y)"
   * Returns: { parentTitle, parentWeight (0-100), parentExternalId }
   */
  private parseAlignedTo(alignedTo: string): {
    parentTitle: string | null;
    parentWeight: number | null;
    parentExternalId: string | null;
  } {
    if (!alignedTo || !alignedTo.trim()) {
      return { parentTitle: null, parentWeight: null, parentExternalId: null };
    }

    // Extract parent title: everything before the first opening parenthesis
    const titleMatch = alignedTo.match(/^([^(]+)/);
    const parentTitle = titleMatch ? titleMatch[1].trim() : null;

    // Extract weight: "weight: X%" where X is a number
    const weightMatch = alignedTo.match(/weight:\s*([\d.]+)%/);
    const parentWeight = weightMatch ? parseFloat(weightMatch[1]) : null;

    // Extract parent ID: "Id: Y" where Y is a number
    const idMatch = alignedTo.match(/Id:\s*(\d+)/);
    const parentExternalId = idMatch ? idMatch[1] : null;

    return { parentTitle, parentWeight, parentExternalId };
  }

  /**
   * Parse object type string to enum
   */
  private parseObjectType(objectTypeStr: string): 'Objective' | 'Key result' | 'Deliverable' {
    const normalized = objectTypeStr?.toLowerCase().trim();
    if (normalized === 'objective') {
      return 'Objective';
    } else if (normalized === 'key result' || normalized === 'keyresult') {
      return 'Key result';
    } else {
      return 'Deliverable';
    }
  }

  /**
   * Parse number string, return null if invalid
   */
  private parseNumber(value: string): number | null {
    if (!value || value.trim() === '') {
      return null;
    }
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Parse check-ins from "Checkins" column
   * Format: "Checkin Date: 2025-03-10; User: Roland Green; Note: ...; Status: On Track; Current Value: 25%; Activity Date: 2025-03-10 20:57:08 UTC;"
   * Multiple check-ins are separated by commas
   */
  private parseCheckins(checkinsStr: string): ParsedCheckIn[] {
    if (!checkinsStr || !checkinsStr.trim()) {
      return [];
    }

    const checkins: ParsedCheckIn[] = [];
    
    // Split by comma to get individual check-ins (but be careful with commas in notes)
    // Simple approach: split by "Checkin Date:" pattern
    const checkinMatches = checkinsStr.match(/Checkin Date:\s*([^;]+);/g);
    
    if (!checkinMatches) {
      return [];
    }

    for (const match of checkinMatches) {
      // Extract the full check-in block
      const startIdx = checkinsStr.indexOf(match);
      let endIdx = checkinsStr.indexOf('Checkin Date:', startIdx + match.length);
      if (endIdx === -1) {
        endIdx = checkinsStr.length;
      }
      const checkinBlock = checkinsStr.substring(startIdx, endIdx);

      // Parse individual fields
      const checkinDateMatch = checkinBlock.match(/Checkin Date:\s*([^;]+)/);
      const userMatch = checkinBlock.match(/User:\s*([^;]+)/);
      const noteMatch = checkinBlock.match(/Note:\s*([^;]+)/);
      const statusMatch = checkinBlock.match(/Status:\s*([^;]+)/);
      const currentValueMatch = checkinBlock.match(/Current Value:\s*([^%]+)%?/);
      const activityDateMatch = checkinBlock.match(/Activity Date:\s*([^;]+)/);

      if (checkinDateMatch) {
        checkins.push({
          checkinDate: checkinDateMatch[1].trim(),
          user: userMatch ? userMatch[1].trim() : '',
          note: noteMatch ? noteMatch[1].trim() : null,
          status: statusMatch ? statusMatch[1].trim() : null,
          currentValue: currentValueMatch ? this.parseNumber(currentValueMatch[1].trim()) : null,
          activityDate: activityDateMatch ? activityDateMatch[1].trim() : '',
        });
      }
    }

    return checkins;
  }
}

