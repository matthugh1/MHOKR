import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req, ForbiddenException, BadRequestException, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { TaskService } from './task.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthenticatedRequest } from '../../common/types/request.types';

@ApiTags('Tasks')
@Controller('tasks')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class TaskController {
  private readonly logger = new Logger(TaskController.name);

  constructor(
    private readonly taskService: TaskService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get all tasks' })
  async getAll(
    @Query('keyResultId') keyResultId: string | undefined,
    @Query('initiativeId') initiativeId: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.taskService.findAll(req.user.id, keyResultId, initiativeId);
  }

  @Get(':id')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get task by ID' })
  async getById(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const canView = await this.taskService.canView(req.user.id, id);
    if (!canView) {
      throw new ForbiddenException('You do not have permission to view this task');
    }
    return this.taskService.findById(id);
  }

  @Post()
  @RequireAction('create_okr')
  @ApiOperation({ summary: 'Create task', description: 'Emits activity event (CREATED) and audit log entry.' })
  async create(@Body() data: any, @Req() req: AuthenticatedRequest) {
    try {
      // Ensure ownerId matches the authenticated user if not provided
      if (!data.ownerId) {
        data.ownerId = req.user.id;
      }

      // Verify user can create tasks for the parent Key Result or Initiative
      if (data.keyResultId) {
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
        
        const canEdit = await this.taskService.canEditParent(req.user.id, data.keyResultId, undefined);
        if (!canEdit) {
          throw new ForbiddenException('You do not have permission to create tasks for this key result');
        }
      }
      
      if (data.initiativeId) {
        const initiative = await this.prisma.initiative.findUnique({
          where: { id: data.initiativeId },
          select: {
            objectiveId: true,
          },
        });
        
        if (!initiative) {
          throw new NotFoundException(`Initiative with ID ${data.initiativeId} not found`);
        }
        
        const canEdit = await this.taskService.canEditParent(req.user.id, undefined, data.initiativeId);
        if (!canEdit) {
          throw new ForbiddenException('You do not have permission to create tasks for this initiative');
        }
      }

      return await this.taskService.create(data, req.user.id, req.user.tenantId);
    } catch (error: any) {
      if (error instanceof ForbiddenException || error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error creating task', { error: error.message || error, stack: error.stack });
      throw new InternalServerErrorException(
        error.message || 'An error occurred while creating the task'
      );
    }
  }

  @Patch(':id')
  @RequireAction('edit_okr')
  @ApiOperation({ summary: 'Update task', description: 'Emits activity event (UPDATED) and audit log entry.' })
  async update(@Param('id') id: string, @Body() data: any, @Req() req: AuthenticatedRequest) {
    const canEdit = await this.taskService.canEdit(req.user.id, id);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to edit this task');
    }
    return this.taskService.update(id, data, req.user.id, req.user.tenantId);
  }

  @Delete(':id')
  @RequireAction('delete_okr')
  @ApiOperation({ summary: 'Delete task', description: 'Emits activity event (DELETED) and audit log entry.' })
  async delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const canDelete = await this.taskService.canDelete(req.user.id, id);
    if (!canDelete) {
      throw new ForbiddenException('You do not have permission to delete this task');
    }
    return this.taskService.delete(id, req.user.id, req.user.tenantId);
  }
}

