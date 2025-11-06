import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req, ForbiddenException, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InitiativeService } from './initiative.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';
import { PrismaService } from '../../common/prisma/prisma.service';

@ApiTags('Initiatives')
@Controller('initiatives')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class InitiativeController {
  constructor(
    private readonly initiativeService: InitiativeService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get all initiatives' })
  async getAll(
    @Query('objectiveId') objectiveId: string | undefined,
    @Query('keyResultId') keyResultId: string | undefined,
    @Req() req: any,
  ) {
    // Filter initiatives based on user's access to their parent objectives
    return this.initiativeService.findAll(req.user.id, objectiveId, keyResultId);
  }

  @Get(':id')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get initiative by ID' })
  async getById(@Param('id') id: string, @Req() req: any) {
    // Check if user can view this initiative (via parent objective)
    const canView = await this.initiativeService.canView(req.user.id, id);
    if (!canView) {
      throw new ForbiddenException('You do not have permission to view this initiative');
    }
    return this.initiativeService.findById(id);
  }

  @Post()
  @RequireAction('create_okr')
  @ApiOperation({ summary: 'Create initiative' })
  async create(@Body() data: any, @Req() req: any) {
    try {
      // Ensure ownerId matches the authenticated user
      if (!data.ownerId) {
        data.ownerId = req.user.id;
      } else if (data.ownerId !== req.user.id) {
        data.ownerId = req.user.id;
      }

      // Verify user can create initiatives for the parent objective
      let objectiveIdToCheck: string | undefined = data.objectiveId;
      
      // If creating from a Key Result, get the objectiveId from the KR's relationship
      if (!objectiveIdToCheck && data.keyResultId) {
        const keyResult = await this.prisma.keyResult.findUnique({
          where: { id: data.keyResultId },
          include: {
            objectives: {
              take: 1,
              select: {
                objectiveId: true,
              },
            },
          },
        });
        
        if (!keyResult) {
          throw new NotFoundException(`Key Result with ID ${data.keyResultId} not found`);
        }
        
        if (keyResult.objectives.length === 0) {
          throw new BadRequestException(`Key Result ${data.keyResultId} is not linked to any Objective`);
        }
        
        objectiveIdToCheck = keyResult.objectives[0].objectiveId;
      }
      
      // Check permissions if we have an objectiveId
      if (objectiveIdToCheck) {
        const canEdit = await this.initiativeService.canEditObjective(req.user.id, objectiveIdToCheck);
        if (!canEdit) {
          throw new ForbiddenException('You do not have permission to create initiatives for this objective');
        }
      }

      return await this.initiativeService.create(data, req.user.id, req.user.tenantId);
    } catch (error: any) {
      // Re-throw known HTTP exceptions
      if (error instanceof ForbiddenException || error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      // Log unexpected errors and return internal server error
      console.error('Error creating initiative:', error);
      throw new InternalServerErrorException(
        error.message || 'An error occurred while creating the initiative'
      );
    }
  }

  @Patch(':id')
  @RequireAction('edit_okr')
  @ApiOperation({ summary: 'Update initiative' })
  async update(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    // Check if user can edit this initiative (via parent objective)
    const canEdit = await this.initiativeService.canEdit(req.user.id, id);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to edit this initiative');
    }
    return this.initiativeService.update(id, data, req.user.id, req.user.tenantId);
  }

  @Delete(':id')
  @RequireAction('delete_okr')
  @ApiOperation({ summary: 'Delete initiative' })
  async delete(@Param('id') id: string, @Req() req: any) {
    // Check if user can delete this initiative (via parent objective)
    const canDelete = await this.initiativeService.canDelete(req.user.id, id);
    if (!canDelete) {
      throw new ForbiddenException('You do not have permission to delete this initiative');
    }
    return this.initiativeService.delete(id, req.user.id, req.user.tenantId);
  }
}
