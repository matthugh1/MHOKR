import { Controller, Get, Query, UseGuards, Req, BadRequestException, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';
import { OkrTenantGuard } from './tenant-guard';

/**
 * OKR Overview Controller
 * 
 * Provides a unified endpoint that returns fully denormalised Objectives
 * with their related Key Results and Initiatives, to be used as the system
 * of record for the OKR list page.
 * 
 * This replaces multiple fragmented API calls (/objectives, /key-results, /initiatives)
 * with a single endpoint: GET /okr/overview
 */
@ApiTags('OKR Overview')
@Controller('okr')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class OkrOverviewController {
  constructor(private prisma: PrismaService) {}

  @Get('overview')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get unified OKR overview with nested Key Results and Initiatives' })
  @ApiQuery({ name: 'organizationId', required: true, description: 'Organization ID for tenant filtering' })
  @ApiQuery({ name: 'cycleId', required: false, description: 'Filter by cycle ID' })
  @ApiQuery({ name: 'status', required: false, enum: ['ON_TRACK', 'AT_RISK', 'BLOCKED', 'COMPLETED', 'CANCELLED'], description: 'Filter by objective status' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 25)' })
  async getOverview(
    @Query('organizationId') organizationId: string | undefined,
    @Query('cycleId') cycleId: string | undefined,
    @Query('status') status: string | undefined,
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: any,
    @Res() res: Response
  ) {
    // Require organizationId query parameter
    if (!organizationId) {
      throw new BadRequestException('organizationId is required');
    }

    // Tenant isolation: validate user has access to this organization
    const userOrganizationId = req.user.organizationId;
    const orgFilter = OkrTenantGuard.buildTenantWhereClause(userOrganizationId);
    
    // If user has a specific org and it doesn't match, deny access
    if (userOrganizationId !== null && orgFilter && orgFilter.organizationId !== organizationId) {
      throw new BadRequestException('You do not have access to this organisation');
    }

    // Parse pagination parameters
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 25;
    
    // Validate pagination parameters
    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      throw new BadRequestException('Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 100');
    }

    const skip = (pageNum - 1) * limitNum;
    const take = limitNum;

    // Build where clause for objectives
    const where: any = { organizationId };
    
    // Apply optional filters
    if (cycleId) {
      where.cycleId = cycleId;
    }
    
    if (status) {
      // Validate status enum
      const validStatuses = ['ON_TRACK', 'AT_RISK', 'BLOCKED', 'COMPLETED', 'CANCELLED'];
      if (!validStatuses.includes(status)) {
        throw new BadRequestException(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
      where.status = status;
    }

    // Fetch objectives with pagination and nested relations, and count total
    const [objectives, total] = await Promise.all([
      this.prisma.objective.findMany({
        where,
        include: {
          keyResults: {
            include: {
              keyResult: true,
            },
          },
          initiatives: true, // Initiatives directly under the Objective
          cycle: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.objective.count({ where }),
    ]);

    // Fetch all initiatives for these objectives' Key Results
    // Since Initiative.keyResultId references KeyResult, we need to fetch separately
    const keyResultIds = objectives.flatMap(o => 
      o.keyResults.map(okr => okr.keyResult.id)
    );

    // Fetch initiatives linked to Key Results
    const krInitiatives = keyResultIds.length > 0
      ? await this.prisma.initiative.findMany({
          where: {
            keyResultId: { in: keyResultIds },
          },
        })
      : [];

    // Group initiatives by keyResultId for efficient lookup
    const initiativesByKrId = new Map<string, typeof krInitiatives>();
    krInitiatives.forEach(init => {
      if (init.keyResultId) {
        if (!initiativesByKrId.has(init.keyResultId)) {
          initiativesByKrId.set(init.keyResultId, []);
        }
        initiativesByKrId.get(init.keyResultId)!.push(init);
      }
    });

    // Transform to unified response format
    const result = objectives.map((o) => ({
      id: o.id,
      title: o.title,
      status: o.status,
      isPublished: o.isPublished,
      progress: o.progress,
      ownerId: o.ownerId,
      owner: o.owner
        ? {
            id: o.owner.id,
            name: o.owner.name,
            email: o.owner.email,
          }
        : null,
      cycle: o.cycle
        ? {
            id: o.cycle.id,
            name: o.cycle.name,
            status: o.cycle.status, // [phase5-core:done] cycleStatus now reflects actual cycle.status or 'NONE', no hardcoded fallback.
          }
        : null,
      cycleStatus: o.cycle ? o.cycle.status : 'NONE', // [phase5-core:done] cycleStatus now reflects actual cycle.status or 'NONE', no hardcoded fallback.
      keyResults: o.keyResults.map((okr) => {
        const kr = okr.keyResult;
        const krInitiatives = initiativesByKrId.get(kr.id) || [];
        return {
          id: kr.id,
          title: kr.title,
          status: kr.status,
          progress: kr.progress,
          cadence: kr.checkInCadence,
          startValue: kr.startValue,
          targetValue: kr.targetValue,
          currentValue: kr.currentValue,
          unit: kr.unit,
          ownerId: kr.ownerId,
          initiatives: krInitiatives.map((i) => ({
            id: i.id,
            title: i.title,
            status: i.status,
            dueDate: i.dueDate,
            keyResultId: i.keyResultId,
          })),
        };
      }),
      initiatives: o.initiatives.map((i) => ({
        id: i.id,
        title: i.title,
        status: i.status,
        dueDate: i.dueDate,
        keyResultId: i.keyResultId,
      })),
      overdueCheckInsCount: 0, // TODO [phase7-hardening]: compute via analytics join
      latestConfidencePct: null, // TODO [phase6-polish]: join latest check-ins
    }));

    // Set pagination headers
    res.set({
      'X-Total-Count': total.toString(),
      'X-Page': pageNum.toString(),
      'X-Limit': limitNum.toString(),
    });

    return res.json(result);
  }
}

