import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { PhasedTargetService, CreatePhasedTargetDto, UpdatePhasedTargetDto } from './phased-target.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction, RequireActionWithContext } from '../rbac';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { buildResourceContextFromOKR, buildResourceContextFromKeyResult } from '../rbac/helpers';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ObjectiveService } from './objective.service';
import { KeyResultService } from './key-result.service';

@ApiTags('Phased Targets')
@Controller('phased-targets')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class PhasedTargetController {
  // Store prisma reference for use in decorator
  private static prismaInstance: PrismaService | null = null;

  constructor(
    private readonly phasedTargetService: PhasedTargetService,
    private readonly objectiveService: ObjectiveService,
    private readonly keyResultService: KeyResultService,
    private readonly prisma: PrismaService,
  ) {
    PhasedTargetController.prismaInstance = prisma;
  }

  @Post()
  @UseGuards(RateLimitGuard)
  @RequireAction('edit_okr')
  @ApiOperation({ summary: 'Create phased target', description: 'Creates a phased target (milestone) for an Objective or Key Result.' })
  @ApiResponse({ status: 201, description: 'Phased target created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or validation error' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Objective or Key Result not found' })
  async create(
    @Body() dto: CreatePhasedTargetDto,
    @Req() req: any,
  ) {
    // Check permissions based on whether it's for Objective or Key Result
    if (dto.objectiveId) {
      const canEdit = await this.objectiveService.canEdit(
        req.user.id,
        dto.objectiveId,
        req.user.tenantId,
      );
      if (!canEdit) {
        throw new ForbiddenException('You do not have permission to edit this objective');
      }
    } else if (dto.keyResultId) {
      const canEdit = await this.keyResultService.canEdit(
        req.user.id,
        dto.keyResultId,
        req.user.tenantId,
      );
      if (!canEdit) {
        throw new ForbiddenException('You do not have permission to edit this key result');
      }
    } else {
      throw new ForbiddenException('Must specify either objectiveId or keyResultId');
    }

    return this.phasedTargetService.create(dto, req.user.tenantId!);
  }

  @Get('objective/:objectiveId')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get phased targets for objective', description: 'Returns all phased targets for an Objective, ordered by order and target date.' })
  @ApiResponse({ status: 200, description: 'List of phased targets' })
  @ApiResponse({ status: 404, description: 'Objective not found' })
  async getByObjective(
    @Param('objectiveId') objectiveId: string,
    @Req() req: any,
  ) {
    return this.phasedTargetService.findByObjective(objectiveId, req.user.tenantId!);
  }

  @Get('key-result/:keyResultId')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get phased targets for key result', description: 'Returns all phased targets for a Key Result, ordered by order and target date.' })
  @ApiResponse({ status: 200, description: 'List of phased targets' })
  @ApiResponse({ status: 404, description: 'Key Result not found' })
  async getByKeyResult(
    @Param('keyResultId') keyResultId: string,
    @Req() req: any,
  ) {
    return this.phasedTargetService.findByKeyResult(keyResultId, req.user.tenantId!);
  }

  @Get(':id')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get phased target by ID' })
  @ApiResponse({ status: 200, description: 'Phased target details' })
  @ApiResponse({ status: 404, description: 'Phased target not found' })
  async getById(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.phasedTargetService.findById(id, req.user.tenantId!);
  }

  @Put(':id')
  @UseGuards(RateLimitGuard)
  @RequireActionWithContext('edit_okr', async (req) => {
    const prisma = PhasedTargetController.prismaInstance;
    if (!prisma) {
      throw new Error('Prisma instance not available');
    }
    // Get phased target to determine if it's for Objective or Key Result
    const phasedTarget = await prisma.phasedTarget.findUnique({
      where: { id: req.params.id },
    });
    if (!phasedTarget) {
      return null;
    }
    if (phasedTarget.objectiveId) {
      return buildResourceContextFromOKR(prisma, phasedTarget.objectiveId);
    } else if (phasedTarget.keyResultId) {
      return buildResourceContextFromKeyResult(prisma, phasedTarget.keyResultId);
    }
    return null;
  })
  @ApiOperation({ summary: 'Update phased target', description: 'Updates a phased target. Validates target date and value against parent OKR constraints.' })
  @ApiResponse({ status: 200, description: 'Phased target updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or validation error' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Phased target not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePhasedTargetDto,
    @Req() req: any,
  ) {
    // Check permissions by getting the phased target and checking parent OKR
    const phasedTarget = await this.phasedTargetService.findById(id, req.user.tenantId!);
    
    if (phasedTarget.objectiveId) {
      const canEdit = await this.objectiveService.canEdit(
        req.user.id,
        phasedTarget.objectiveId,
        req.user.tenantId,
      );
      if (!canEdit) {
        throw new ForbiddenException('You do not have permission to edit this objective');
      }
    } else if (phasedTarget.keyResultId) {
      const canEdit = await this.keyResultService.canEdit(
        req.user.id,
        phasedTarget.keyResultId,
        req.user.tenantId,
      );
      if (!canEdit) {
        throw new ForbiddenException('You do not have permission to edit this key result');
      }
    }

    return this.phasedTargetService.update(id, dto, req.user.tenantId!);
  }

  @Delete(':id')
  @UseGuards(RateLimitGuard)
  @RequireActionWithContext('edit_okr', async (req) => {
    const prisma = PhasedTargetController.prismaInstance;
    if (!prisma) {
      throw new Error('Prisma instance not available');
    }
    const phasedTarget = await prisma.phasedTarget.findUnique({
      where: { id: req.params.id },
    });
    if (!phasedTarget) {
      return null;
    }
    if (phasedTarget.objectiveId) {
      return buildResourceContextFromOKR(prisma, phasedTarget.objectiveId);
    } else if (phasedTarget.keyResultId) {
      return buildResourceContextFromKeyResult(prisma, phasedTarget.keyResultId);
    }
    return null;
  })
  @ApiOperation({ summary: 'Delete phased target', description: 'Deletes a phased target.' })
  @ApiResponse({ status: 200, description: 'Phased target deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Phased target not found' })
  async delete(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    // Check permissions by getting the phased target and checking parent OKR
    const phasedTarget = await this.phasedTargetService.findById(id, req.user.tenantId!);
    
    if (phasedTarget.objectiveId) {
      const canEdit = await this.objectiveService.canEdit(
        req.user.id,
        phasedTarget.objectiveId,
        req.user.tenantId,
      );
      if (!canEdit) {
        throw new ForbiddenException('You do not have permission to edit this objective');
      }
    } else if (phasedTarget.keyResultId) {
      const canEdit = await this.keyResultService.canEdit(
        req.user.id,
        phasedTarget.keyResultId,
        req.user.tenantId,
      );
      if (!canEdit) {
        throw new ForbiddenException('You do not have permission to edit this key result');
      }
    }

    await this.phasedTargetService.delete(id, req.user.tenantId!);
    return { success: true };
  }
}

