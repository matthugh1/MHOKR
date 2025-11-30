import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';
import { FeedbackQueryDto } from './dto/feedback-query.dto';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(private prisma: PrismaService) {}

  async createFeedback(
    userId: string,
    tenantId: string | null,
    data: {
      message: string;
      pageUrl: string;
      userAgent?: string;
      errors?: any;
      metadata?: any;
    },
  ) {
    this.logger.log(`Creating feedback for user ${userId}`);

    const feedback = await this.prisma.feedback.create({
      data: {
        userId,
        tenantId: tenantId || undefined,
        message: data.message,
        pageUrl: data.pageUrl,
        userAgent: data.userAgent,
        errors: data.errors ? JSON.parse(JSON.stringify(data.errors)) : null,
        metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    this.logger.log(`Feedback created with ID ${feedback.id}`);
    return feedback;
  }

  async findAll(tenantId: string | null, query?: FeedbackQueryDto) {
    const where: any = {};

    // Superuser can see all feedback, normal users see only their tenant's feedback
    if (tenantId !== null) {
      where.tenantId = tenantId;
    }

    // Apply filters from query
    if (query?.resolved !== undefined) {
      where.resolved = query.resolved;
    }

    if (query?.tenantId) {
      where.tenantId = query.tenantId;
    }

    if (query?.userId) {
      where.userId = query.userId;
    }

    const take = query?.limit || undefined;
    const skip = query?.offset || undefined;

    return this.prisma.feedback.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take,
      skip,
    });
  }

  async findOne(id: string, tenantId: string | null) {
    const feedback = await this.prisma.feedback.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!feedback) {
      throw new NotFoundException(`Feedback with ID ${id} not found`);
    }

    // Check tenant access (superuser can see all, others only their tenant)
    if (tenantId !== null && feedback.tenantId !== tenantId) {
      throw new ForbiddenException('You do not have access to this feedback');
    }

    return feedback;
  }

  async update(id: string, tenantId: string | null, updateDto: UpdateFeedbackDto) {
    // First check if feedback exists and user has access
    const existing = await this.findOne(id, tenantId);

    const updated = await this.prisma.feedback.update({
      where: { id },
      data: {
        ...updateDto,
        updatedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    this.logger.log(`Feedback ${id} updated`);
    return updated;
  }

  async remove(id: string, tenantId: string | null) {
    // First check if feedback exists and user has access
    await this.findOne(id, tenantId);

    await this.prisma.feedback.delete({
      where: { id },
    });

    this.logger.log(`Feedback ${id} deleted`);
    return { message: 'Feedback deleted successfully' };
  }

  async getStats(tenantId: string | null) {
    const where: any = {};
    if (tenantId !== null) {
      where.tenantId = tenantId;
    }

    const [total, resolved, unresolved] = await Promise.all([
      this.prisma.feedback.count({ where }),
      this.prisma.feedback.count({ where: { ...where, resolved: true } }),
      this.prisma.feedback.count({ where: { ...where, resolved: false } }),
    ]);

    return {
      total,
      resolved,
      unresolved,
      resolutionRate: total > 0 ? (resolved / total) * 100 : 0,
    };
  }
}

