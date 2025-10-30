/**
 * Context Builder
 * 
 * Factory functions for building ResourceContext from common scenarios.
 */

import { PrismaService } from '../../common/prisma/prisma.service';
import { ResourceContext } from './types';
import {
  buildResourceContextFromOKR,
  buildResourceContextFromKeyResult,
  buildResourceContextFromRequest,
} from './helpers';

/**
 * Context builder factory
 */
export class ResourceContextBuilder {
  constructor(private prisma: PrismaService) {}

  /**
   * Build context from OKR ID
   */
  async fromOKR(okrId: string): Promise<ResourceContext> {
    return buildResourceContextFromOKR(this.prisma, okrId);
  }

  /**
   * Build context from Key Result ID
   */
  async fromKeyResult(keyResultId: string): Promise<ResourceContext> {
    return buildResourceContextFromKeyResult(this.prisma, keyResultId);
  }

  /**
   * Build context from request
   */
  fromRequest(request: any): ResourceContext {
    return buildResourceContextFromRequest(request);
  }

  /**
   * Build context from explicit values
   */
  fromValues(
    tenantId: string,
    workspaceId?: string | null,
    teamId?: string | null,
    okr?: any,
    tenant?: any,
  ): ResourceContext {
    return {
      tenantId,
      workspaceId: workspaceId || null,
      teamId: teamId || null,
      okr,
      tenant,
    };
  }
}

