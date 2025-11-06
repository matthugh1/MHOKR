import { Controller, Get, Post, Body, Query, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiBody } from '@nestjs/swagger';
import { CheckInRequestService } from './checkin-request.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';

/**
 * CheckInRequest Controller
 * 
 * Endpoints for async check-in requests and responses (Milestone 1).
 * 
 * Tenant isolation and RBAC are enforced following the same patterns as okr-overview.controller.
 */
@ApiTags('Check-in Requests')
@Controller('okr')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class CheckInRequestController {
  constructor(private readonly checkInRequestService: CheckInRequestService) {}

  @Post('checkin-requests')
  @UseGuards(RateLimitGuard)
  @RequireAction('request_checkin')
  @ApiOperation({ summary: 'Create async check-in requests for one or more team members' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        targetUserIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of user IDs who need to submit updates',
        },
        dueAt: {
          type: 'string',
          format: 'date-time',
          description: 'When the updates are due (ISO 8601)',
        },
      },
      required: ['targetUserIds', 'dueAt'],
    },
  })
  async createRequests(@Body() body: { targetUserIds: string[]; dueAt: string }, @Req() req: any) {
    const { targetUserIds, dueAt } = body;

    if (!targetUserIds || !Array.isArray(targetUserIds) || targetUserIds.length === 0) {
      throw new BadRequestException('targetUserIds must be a non-empty array');
    }

    if (!dueAt) {
      throw new BadRequestException('dueAt is required');
    }

    const dueDate = new Date(dueAt);
    if (isNaN(dueDate.getTime())) {
      throw new BadRequestException('dueAt must be a valid ISO 8601 date-time');
    }

    return this.checkInRequestService.createRequests(
      req.user.id,
      targetUserIds,
      dueDate,
      req.user.tenantId,
    );
  }

  @Get('checkin-requests/mine')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get all OPEN or LATE check-in requests for the current user' })
  async getMyRequests(@Req() req: any) {
    return this.checkInRequestService.getMyRequests(req.user.id, req.user.tenantId);
  }

  @Post('checkin-responses')
  @RequireAction('edit_okr') // TODO [phase7-hardening]: Consider a more specific action
  @ApiOperation({ summary: 'Submit an async check-in response' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        requestId: {
          type: 'string',
          description: 'Check-in request ID',
        },
        summaryWhatMoved: {
          type: 'string',
          description: 'What moved? (optional)',
        },
        summaryBlocked: {
          type: 'string',
          description: "What's blocked? (optional)",
        },
        summaryNeedHelp: {
          type: 'string',
          description: 'What do you need? (optional)',
        },
      },
      required: ['requestId'],
    },
  })
  async submitResponse(
    @Body() body: {
      requestId: string;
      summaryWhatMoved?: string;
      summaryBlocked?: string;
      summaryNeedHelp?: string;
    },
    @Req() req: any,
  ) {
    const { requestId, summaryWhatMoved, summaryBlocked, summaryNeedHelp } = body;

    if (!requestId) {
      throw new BadRequestException('requestId is required');
    }

    return this.checkInRequestService.submitResponse(
      requestId,
      req.user.id,
      {
        summaryWhatMoved,
        summaryBlocked,
        summaryNeedHelp,
      },
      req.user.tenantId,
    );
  }

  @Get('checkin-rollup')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get team check-in rollup summary for managers' })
  @ApiQuery({ name: 'cycleId', required: false, description: 'Filter by cycle ID' })
  @ApiQuery({ name: 'teamId', required: false, description: 'Filter by team ID' })
  @ApiQuery({ name: 'daysBack', required: false, type: Number, description: 'Number of days to look back (default: 14)' })
  async getRollup(
    @Query('cycleId') cycleId: string | undefined,
    @Query('teamId') teamId: string | undefined,
    @Query('daysBack') daysBack: string | undefined,
    @Req() req: any,
  ) {
    const daysBackNum = daysBack ? parseInt(daysBack, 10) : 14;
    
    if (daysBack && (isNaN(daysBackNum) || daysBackNum < 1 || daysBackNum > 90)) {
      throw new BadRequestException('daysBack must be between 1 and 90');
    }

    return this.checkInRequestService.getRollup(
      req.user.id,
      cycleId,
      teamId,
      daysBackNum,
      req.user.tenantId,
    );
  }
}


