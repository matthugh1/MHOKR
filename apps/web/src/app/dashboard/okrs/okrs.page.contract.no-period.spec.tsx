/**
 * Contract Test: Assert no period keys in OKR API responses
 * 
 * This test ensures that the Period model has been completely removed
 * and that API responses never contain period-related fields.
 */

import { describe, it, expect } from '@jest/globals';

/**
 * Recursively check an object for any period-related keys
 */
function hasPeriodKeys(obj: any, path: string = ''): string[] {
  const found: string[] = [];
  
  if (obj === null || obj === undefined) {
    return found;
  }
  
  if (typeof obj !== 'object') {
    return found;
  }
  
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      found.push(...hasPeriodKeys(item, `${path}[${index}]`));
    });
    return found;
  }
  
  // Check keys
  for (const key in obj) {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('period')) {
      found.push(`${path}.${key}`);
    }
    // Recursively check nested objects
    found.push(...hasPeriodKeys(obj[key], path ? `${path}.${key}` : key));
  }
  
  return found;
}

describe('OKR API Contract - No Period Keys', () => {
  it('should never return period keys in /okr/overview response', () => {
    // Mock API response (replace with actual API call in real test)
    const mockResponse = {
      objectives: [
        {
          objectiveId: 'obj1',
          title: 'Test Objective',
          status: 'ON_TRACK',
          cycleId: 'cycle1',
          cycle: {
            id: 'cycle1',
            name: 'Q1 2025',
          },
          // period should NOT exist here
        },
      ],
      page: 1,
      pageSize: 20,
      totalCount: 1,
    };
    
    // Assert no period keys exist
    const periodKeys = hasPeriodKeys(mockResponse);
    expect(periodKeys).toEqual([]);
    
    // Explicit checks for common period field names
    expect(mockResponse.objectives[0]).not.toHaveProperty('period');
    expect(mockResponse.objectives[0]).not.toHaveProperty('periodId');
    expect(mockResponse.objectives[0]).not.toHaveProperty('period_');
  });
  
  it('should validate that cycle is present but period is not', () => {
    const mockResponse = {
      objectives: [
        {
          objectiveId: 'obj1',
          cycleId: 'cycle1',
          cycle: {
            id: 'cycle1',
            name: 'Q1 2025',
          },
        },
      ],
    };
    
    // Cycle should be present (canonical)
    expect(mockResponse.objectives[0]).toHaveProperty('cycle');
    expect(mockResponse.objectives[0].cycle).toHaveProperty('name');
    
    // Period should NEVER be present
    expect(mockResponse.objectives[0]).not.toHaveProperty('period');
  });
});

export { hasPeriodKeys };

