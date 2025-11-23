/**
 * Shared utility for mapping raw objective data from the API to the view model format.
 * 
 * This function handles the transformation of objective data including:
 * - Key results with check-in information
 * - Initiatives deduplication
 * - Cycle information
 * - Owner information
 * 
 * Used by both OKRPageContainer and OKRTreeContainer to ensure consistency.
 */

export interface RawObjective {
  id?: string;
  objectiveId?: string;
  title: string;
  status?: string;
  progress?: number;
  ownerId?: string;
  owner?: { id: string; name: string; email?: string };
  cycle?: { id: string; name: string; status?: string };
  cycleId?: string;
  cycleName?: string;
  cycleStatus?: string;
  keyResults?: Array<{
    id?: string;
    keyResultId?: string;
    weight?: number;
    keyResult?: any;
    initiatives?: any[];
    checkIns?: any[];
    canCheckIn?: boolean;
    [key: string]: any;
  }>;
  initiatives?: any[];
  isPublished?: boolean;
  publishState?: string;
  visibilityLevel?: string;
  parentId?: string;
  parentObjectiveId?: string;
  organizationId?: string;
  tenantId?: string;
  workspaceId?: string;
  teamId?: string;
  cycle?: { id: string; name: string; status?: string };
  pillarId?: string;
  canEdit?: boolean;
  canDelete?: boolean;
  overdueCheckInsCount?: number;
  latestConfidencePct?: number;
  [key: string]: any;
}

export interface User {
  id: string;
  name?: string;
  email?: string;
}

export interface Cycle {
  id: string;
  name: string;
  status?: string;
}

export interface OverdueCheckIn {
  krId: string;
  objectiveId: string;
}

export interface MappedKeyResult {
  id: string;
  title: string;
  status: string;
  progress: number;
  currentValue?: number;
  targetValue?: number;
  startValue?: number;
  unit?: string;
  checkInCadence?: string;
  isOverdue: boolean;
  ownerId?: string;
  lastCheckInDate?: string | null;
  nextCheckInDue?: string | null;
  canCheckIn: boolean;
  weight: number;
}

export interface MappedInitiative {
  id: string;
  title: string;
  description?: string;
  status: string;
  dueDate?: string;
  keyResultId?: string;
  keyResultTitle?: string;
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MappedObjective {
  id: string;
  title: string;
  status: string;
  publishState: string;
  isPublished: boolean;
  visibilityLevel: string;
  cycleName?: string;
  cycleLabel: string;
  cycleStatus: string;
  owner: {
    id: string;
    name: string;
    email: string | null;
  };
  progress: number;
  keyResults: MappedKeyResult[];
  initiatives: MappedInitiative[];
  overdueCountForObjective: number;
  lowestConfidence: number | null;
  ownerId?: string;
  organizationId?: string;
  workspaceId?: string;
  teamId?: string;
  cycleId?: string;
  pillarId?: string | null;
  tenantId?: string;
  parentId?: string | null;
  parentObjectiveId?: string | null;
  canEdit: boolean;
  canDelete: boolean;
}

interface MapObjectiveDataOptions {
  includeCheckInDates?: boolean; // Include lastCheckInDate and nextCheckInDue
  useParentObjectiveId?: boolean; // Use parentObjectiveId instead of parentId (for tree view)
}

/**
 * Maps raw objective data from API to view model format.
 * 
 * @param rawObj - Raw objective data from API
 * @param availableUsers - List of available users for owner lookup
 * @param activeCycles - List of active cycles for cycle lookup
 * @param overdueCheckIns - List of overdue check-ins
 * @param options - Optional configuration for different use cases
 * @returns Mapped objective data ready for UI consumption
 */
export function mapObjectiveData(
  rawObj: RawObjective,
  availableUsers: User[],
  activeCycles: Cycle[],
  overdueCheckIns: OverdueCheckIn[],
  options: MapObjectiveDataOptions = {}
): MappedObjective {
  const { includeCheckInDates = false, useParentObjectiveId = false } = options;

  // Resolve cycle information
  const cycle = rawObj.cycle || (rawObj.cycleId ? activeCycles.find(c => c.id === rawObj.cycleId) : null);
  const cycleName = cycle?.name ?? rawObj.cycleName ?? undefined;
  const cycleStatus = rawObj.cycleStatus || (cycle?.status ?? 'ACTIVE');

  let cycleLabel = cycleName || 'Unassigned';
  if (cycleStatus === 'DRAFT' && cycleName) {
    cycleLabel = `${cycleName} (draft)`;
  }

  // Map key results
  const keyResults: MappedKeyResult[] = (rawObj.keyResults || []).map((kr: any): MappedKeyResult => {
    const krId = kr.keyResultId || kr.id;
    const isOverdue = overdueCheckIns.some(item => item.krId === krId);

    // Extract KR data - handle both junction table format and direct format
    const krData = kr.keyResult || kr;
    const weight = kr.weight ?? 1.0; // Extract weight from junction table, default to 1.0

    const mappedKr: MappedKeyResult = {
      id: krId,
      title: krData.title || kr.title,
      status: krData.status || kr.status,
      progress: krData.progress ?? kr.progress ?? 0,
      currentValue: krData.currentValue ?? kr.currentValue,
      targetValue: krData.targetValue ?? kr.targetValue,
      startValue: krData.startValue ?? kr.startValue,
      unit: krData.unit || kr.unit,
      checkInCadence: krData.checkInCadence || kr.cadence,
      isOverdue,
      ownerId: krData.ownerId || kr.ownerId,
      canCheckIn: kr.canCheckIn !== undefined ? kr.canCheckIn : false,
      weight,
    };

    // Calculate last check-in date and next check-in due if requested
    if (includeCheckInDates) {
      let lastCheckInDate: string | null = null;
      let nextCheckInDue: string | null = null;

      const checkIns = krData.checkIns || kr.checkIns;
      if (checkIns && Array.isArray(checkIns) && checkIns.length > 0) {
        // Get the most recent check-in
        const latestCheckIn = checkIns[0];
        lastCheckInDate = latestCheckIn.createdAt || null;

        // Calculate next check-in due based on cadence
        const cadence = krData.checkInCadence || kr.cadence;
        if (cadence && cadence !== 'NONE' && lastCheckInDate) {
          const lastCheckIn = new Date(lastCheckInDate);
          let daysBetween = 7;
          switch (cadence) {
            case 'WEEKLY':
              daysBetween = 7;
              break;
            case 'BIWEEKLY':
              daysBetween = 14;
              break;
            case 'MONTHLY':
              daysBetween = 30; // Match backend: check-in-due-calculator.ts uses 30 days
              break;
          }
          const nextDue = new Date(lastCheckIn.getTime() + daysBetween * 24 * 60 * 60 * 1000);
          nextCheckInDue = nextDue.toISOString();
        }
      }

      mappedKr.lastCheckInDate = lastCheckInDate;
      mappedKr.nextCheckInDue = nextCheckInDue;
    }

    return mappedKr;
  });

  // Calculate overdue count
  const overdueCountForObjective = rawObj.overdueCheckInsCount !== undefined
    ? rawObj.overdueCheckInsCount
    : keyResults.filter((kr) => kr.isOverdue).length;

  // Get lowest confidence
  const lowestConfidence = rawObj.latestConfidencePct !== undefined
    ? rawObj.latestConfidencePct
    : null;

  // Collect and deduplicate initiatives
  const seenInitIds = new Set<string>();
  const allInitiatives: any[] = [];

  // First, add initiatives from Key Results (they have KR context which is more useful)
  (rawObj.keyResults || []).forEach((kr: any) => {
    (kr.initiatives || []).forEach((init: any) => {
      if (!seenInitIds.has(init.id)) {
        seenInitIds.add(init.id);
        allInitiatives.push({
          ...init,
          keyResultId: kr.keyResultId || kr.id,
          keyResultTitle: kr.title,
        });
      }
    });
  });

  // Then, add objective-only initiatives (skip if already seen from KR)
  (rawObj.initiatives || []).forEach((init: any) => {
    if (!seenInitIds.has(init.id)) {
      seenInitIds.add(init.id);
      allInitiatives.push({
        ...init,
        keyResultId: init.keyResultId,
        keyResultTitle: init.keyResultTitle,
      });
    }
  });

  // Map initiatives to consistent format
  const initiatives: MappedInitiative[] = allInitiatives.map((init: any) => ({
    id: init.id,
    title: init.title,
    description: includeCheckInDates ? init.description : undefined, // Only include description for page view
    status: init.status,
    dueDate: init.dueDate,
    keyResultId: init.keyResultId,
    keyResultTitle: init.keyResultTitle,
    ownerId: includeCheckInDates ? (init.ownerId || undefined) : undefined,
    createdAt: includeCheckInDates ? (init.createdAt || undefined) : undefined,
    updatedAt: includeCheckInDates ? (init.updatedAt || undefined) : undefined,
  }));

  // Resolve owner information
  const owner = rawObj.owner || availableUsers.find(u => u.id === rawObj.ownerId);

  // Map publish state
  const publishState = rawObj.publishState || (rawObj.isPublished ? 'PUBLISHED' : 'DRAFT');

  // Build result object
  const result: MappedObjective = {
    id: rawObj.objectiveId || rawObj.id || '',
    title: rawObj.title,
    status: rawObj.status || 'ON_TRACK',
    publishState,
    isPublished: rawObj.isPublished ?? false,
    visibilityLevel: rawObj.visibilityLevel || 'PUBLIC_TENANT',
    cycleName,
    cycleLabel,
    cycleStatus,
    owner: {
      id: rawObj.ownerId || owner?.id || '',
      name: owner?.name || owner?.email || 'Unassigned',
      email: owner?.email || null,
    },
    progress: rawObj.progress ?? 0,
    keyResults,
    initiatives,
    overdueCountForObjective,
    lowestConfidence,
    ownerId: rawObj.ownerId,
    organizationId: rawObj.organizationId,
    workspaceId: rawObj.workspaceId,
    teamId: rawObj.teamId,
    cycleId: rawObj.cycle?.id || rawObj.cycleId,
    canEdit: rawObj.canEdit !== undefined ? rawObj.canEdit : false,
    canDelete: rawObj.canDelete !== undefined ? rawObj.canDelete : false,
  };

  // Handle parent ID based on use case
  if (useParentObjectiveId) {
    result.parentObjectiveId = rawObj.parentObjectiveId || rawObj.parentId || null;
  } else {
    result.parentId = rawObj.parentId || null;
  }

  // Include additional fields for page view
  if (includeCheckInDates) {
    result.pillarId = rawObj.pillarId || null;
    result.tenantId = rawObj.tenantId || rawObj.organizationId || '';
  }

  return result;
}


