import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export type StandardCycleType = 'MONTH' | 'QUARTER' | 'YEAR';

export interface StandardCycleDefinition {
  name: string;
  startDate: Date;
  endDate: Date;
  type: StandardCycleType;
}

@Injectable()
export class CycleGeneratorService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate standard cycles for a date range
   * @param organizationId - Organization to generate cycles for
   * @param startDate - Start of range (inclusive)
   * @param endDate - End of range (inclusive)
   * @returns Array of created cycles
   */
  async ensureStandardCycles(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    const definitions = this.generateStandardCycleDefinitions(startDate, endDate);
    const created: any[] = [];

    for (const def of definitions) {
      // Check if cycle already exists (by date range and name pattern)
      const existing = await this.prisma.cycle.findFirst({
        where: {
          organizationId,
          name: def.name,
          startDate: def.startDate,
          endDate: def.endDate,
        },
      });

      if (!existing) {
        // Check for overlapping cycles (avoid duplicates)
        const overlapping = await this.prisma.cycle.findFirst({
          where: {
            organizationId,
            OR: [
              {
                startDate: { lte: def.startDate },
                endDate: { gte: def.startDate },
              },
              {
                startDate: { lte: def.endDate },
                endDate: { gte: def.endDate },
              },
              {
                startDate: { gte: def.startDate },
                endDate: { lte: def.endDate },
              },
            ],
          },
        });

        // Only create if no overlap exists
        if (!overlapping) {
          const cycle = await this.prisma.cycle.create({
            data: {
              organizationId,
              name: def.name,
              startDate: def.startDate,
              endDate: def.endDate,
              status: 'DRAFT',
              isStandard: true,
            } as any, // Type assertion needed until Prisma client is regenerated
          });
          created.push(cycle);
        }
      }
    }

    return created;
  }

  /**
   * Generate standard cycle definitions for a date range
   * Returns months, quarters, and years within the range
   */
  private generateStandardCycleDefinitions(
    startDate: Date,
    endDate: Date,
  ): StandardCycleDefinition[] {
    const definitions: StandardCycleDefinition[] = [];
    
    // Clone dates to avoid mutation
    const current = new Date(startDate);
    const end = new Date(endDate);

    // Generate months
    while (current <= end) {
      const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59, 999);
      
      if (monthEnd >= startDate && monthStart <= endDate) {
        const monthName = monthStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        definitions.push({
          name: monthName,
          startDate: monthStart,
          endDate: monthEnd,
          type: 'MONTH',
        });
      }

      // Move to next month
      current.setMonth(current.getMonth() + 1);
      current.setDate(1);
    }

    // Generate quarters
    const quarterStart = new Date(startDate);
    quarterStart.setMonth(Math.floor(quarterStart.getMonth() / 3) * 3);
    quarterStart.setDate(1);
    
    current.setTime(quarterStart.getTime());
    
    while (current <= end) {
      const quarterNum = Math.floor(current.getMonth() / 3) + 1;
      const quarterStartDate = new Date(current.getFullYear(), current.getMonth(), 1);
      const quarterEndDate = new Date(current.getFullYear(), current.getMonth() + 3, 0, 23, 59, 59, 999);
      
      if (quarterEndDate >= startDate && quarterStartDate <= endDate) {
        definitions.push({
          name: `Q${quarterNum} ${current.getFullYear()}`,
          startDate: quarterStartDate,
          endDate: quarterEndDate,
          type: 'QUARTER',
        });
      }

      // Move to next quarter
      current.setMonth(current.getMonth() + 3);
    }

    // Generate years
    const yearStart = new Date(startDate);
    yearStart.setMonth(0);
    yearStart.setDate(1);
    
    current.setTime(yearStart.getTime());
    
    while (current <= end) {
      const yearStartDate = new Date(current.getFullYear(), 0, 1);
      const yearEndDate = new Date(current.getFullYear(), 11, 31, 23, 59, 59, 999);
      
      if (yearEndDate >= startDate && yearStartDate <= endDate) {
        definitions.push({
          name: `${current.getFullYear()}`,
          startDate: yearStartDate,
          endDate: yearEndDate,
          type: 'YEAR',
        });
      }

      // Move to next year
      current.setFullYear(current.getFullYear() + 1);
    }

    // Sort by start date
    definitions.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    return definitions;
  }

  /**
   * Get or create a standard cycle for a specific period
   * @param organizationId - Organization ID
   * @param type - Type of cycle (MONTH, QUARTER, YEAR)
   * @param date - Date within the period (used to determine which month/quarter/year)
   * @returns The cycle (existing or newly created)
   */
  async getOrCreateStandardCycle(
    organizationId: string,
    type: StandardCycleType,
    date: Date,
  ): Promise<any> {
    let name: string;
    let startDate: Date;
    let endDate: Date;

    switch (type) {
      case 'MONTH': {
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
        name = monthStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        startDate = monthStart;
        endDate = monthEnd;
        break;
      }
      case 'QUARTER': {
        const quarterNum = Math.floor(date.getMonth() / 3) + 1;
        const quarterStart = new Date(date.getFullYear(), (quarterNum - 1) * 3, 1);
        const quarterEnd = new Date(date.getFullYear(), quarterNum * 3, 0, 23, 59, 59, 999);
        name = `Q${quarterNum} ${date.getFullYear()}`;
        startDate = quarterStart;
        endDate = quarterEnd;
        break;
      }
      case 'YEAR': {
        const yearStart = new Date(date.getFullYear(), 0, 1);
        const yearEnd = new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
        name = `${date.getFullYear()}`;
        startDate = yearStart;
        endDate = yearEnd;
        break;
      }
    }

    // Check if cycle already exists
    const existing = await this.prisma.cycle.findFirst({
      where: {
        organizationId,
        name,
        startDate,
        endDate,
      },
    });

    if (existing) {
      return existing;
    }

    // Check for overlapping cycles
    const overlapping = await this.prisma.cycle.findFirst({
      where: {
        organizationId,
        OR: [
          {
            startDate: { lte: startDate },
            endDate: { gte: startDate },
          },
          {
            startDate: { lte: endDate },
            endDate: { gte: endDate },
          },
          {
            startDate: { gte: startDate },
            endDate: { lte: endDate },
          },
        ],
      },
    });

    if (overlapping) {
      return overlapping;
    }

    // Create the cycle
    return this.prisma.cycle.create({
      data: {
        organizationId,
        name,
        startDate,
        endDate,
        status: 'DRAFT',
        isStandard: true,
      } as any,
    });
  }

  /**
   * Get smart date range for cycle generation
   * Generates cycles for: current month ± 2 months, current quarter ± 2 quarters, current year ± 1 year
   */
  getSmartDateRange(): { startDate: Date; endDate: Date } {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Start: 2 months before current month, 2 quarters before current quarter, 1 year before current year
    const startDate = new Date(currentYear - 1, 0, 1); // Start of previous year
    
    // End: 2 months after current month, 2 quarters after current quarter, 1 year after current year
    const endDate = new Date(currentYear + 1, 11, 31, 23, 59, 59, 999); // End of next year
    
    return { startDate, endDate };
  }
}

