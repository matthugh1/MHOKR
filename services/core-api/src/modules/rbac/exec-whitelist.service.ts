/**
 * EXEC_ONLY Whitelist Service
 * 
 * Manages the whitelist of users who can view EXEC_ONLY OKRs at the tenant level.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ExecWhitelistService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get the EXEC_ONLY whitelist for a tenant
   */
  async getWhitelist(tenantId: string): Promise<string[]> {
    const tenant = await this.prisma.organization.findUnique({
      where: { id: tenantId },
      select: { execOnlyWhitelist: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    if (!tenant.execOnlyWhitelist || !Array.isArray(tenant.execOnlyWhitelist)) {
      return [];
    }

    return tenant.execOnlyWhitelist as string[];
  }

  /**
   * Add a user to the EXEC_ONLY whitelist
   */
  async addToWhitelist(tenantId: string, userId: string): Promise<string[]> {
    const whitelist = await this.getWhitelist(tenantId);

    if (!whitelist.includes(userId)) {
      const updated = [...whitelist, userId];
      await this.prisma.organization.update({
        where: { id: tenantId },
        data: { execOnlyWhitelist: updated },
      });
      return updated;
    }

    return whitelist;
  }

  /**
   * Remove a user from the EXEC_ONLY whitelist
   */
  async removeFromWhitelist(tenantId: string, userId: string): Promise<string[]> {
    const whitelist = await this.getWhitelist(tenantId);

    const updated = whitelist.filter(id => id !== userId);
    
    await this.prisma.organization.update({
      where: { id: tenantId },
      data: { execOnlyWhitelist: updated },
    });

    return updated;
  }

  /**
   * Set the entire whitelist (replaces existing)
   */
  async setWhitelist(tenantId: string, userIds: string[]): Promise<string[]> {
    await this.prisma.organization.update({
      where: { id: tenantId },
      data: { execOnlyWhitelist: userIds },
    });

    return userIds;
  }

  /**
   * Check if a user is whitelisted
   */
  async isWhitelisted(tenantId: string, userId: string): Promise<boolean> {
    const whitelist = await this.getWhitelist(tenantId);
    return whitelist.includes(userId);
  }

  /**
   * Clear the whitelist
   */
  async clearWhitelist(tenantId: string): Promise<void> {
    await this.prisma.organization.update({
      where: { id: tenantId },
      data: { execOnlyWhitelist: [] },
    });
  }
}

