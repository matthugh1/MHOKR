import { Controller, Post, Get, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';
import { FeedbackQueryDto } from './dto/feedback-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';
import { AuthenticatedRequest } from '../../common/types/request.types';

@ApiTags('Feedback')
@Controller('feedback')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @ApiOperation({ summary: 'Submit feedback (requires authentication)' })
  async createFeedback(
    @Body() createFeedbackDto: CreateFeedbackDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.feedbackService.createFeedback(
      req.user.id,
      req.user.tenantId || null,
      createFeedbackDto,
    );
  }

  @Get()
  @RequireAction('manage_users') // Only admins/superusers can view feedback
  @ApiOperation({ summary: 'Get all feedback with optional filters (admin/superuser only)' })
  @ApiQuery({ name: 'resolved', required: false, type: Boolean, description: 'Filter by resolved status' })
  @ApiQuery({ name: 'tenantId', required: false, type: String, description: 'Filter by tenant ID' })
  @ApiQuery({ name: 'userId', required: false, type: String, description: 'Filter by user ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limit number of results' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Offset for pagination' })
  async getAllFeedback(
    @Query() query: FeedbackQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.feedbackService.findAll(req.user.tenantId, query);
  }

  @Get('stats')
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Get feedback statistics (admin/superuser only)' })
  async getStats(@Req() req: AuthenticatedRequest) {
    return this.feedbackService.getStats(req.user.tenantId);
  }

  @Get(':id')
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Get feedback by ID (admin/superuser only)' })
  @ApiParam({ name: 'id', description: 'Feedback ID' })
  async getFeedbackById(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.feedbackService.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Update feedback (admin/superuser only)' })
  @ApiParam({ name: 'id', description: 'Feedback ID' })
  async updateFeedback(
    @Param('id') id: string,
    @Body() updateDto: UpdateFeedbackDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.feedbackService.update(id, req.user.tenantId, updateDto);
  }

  @Delete(':id')
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Delete feedback (admin/superuser only)' })
  @ApiParam({ name: 'id', description: 'Feedback ID' })
  async deleteFeedback(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.feedbackService.remove(id, req.user.tenantId);
  }
}

