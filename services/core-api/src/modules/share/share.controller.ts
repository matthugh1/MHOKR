/**
 * Share Controller
 * 
 * Endpoints for creating, revoking, and resolving share links for OKR objects.
 */

import { Controller, Post, Get, Delete, Body, Param, UseGuards, Req, BadRequestException, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ShareService } from './share.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, Public } from '../rbac';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';

export interface CreateShareLinkDto {
  expiresAt: string; // ISO date string
  note?: string;
}

@ApiTags('Share Links')
@Controller()
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  /**
   * Create a share link for an OKR object.
   * 
   * POST /okrs/:type/:id/share
   * 
   * @param type - Entity type: 'objectives' or 'key-results'
   * @param id - Entity ID
   * @param body - Share link creation data
   * @param req - Request object with user info
   */
  @Post('okrs/:type/:id/share')
  @UseGuards(JwtAuthGuard, RBACGuard, RateLimitGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Create a share link for an OKR object',
    description: 'Creates a tenant-scoped share link that grants read-only access to users in the same tenant. Requires owner or tenant admin permissions. Share links expire automatically and can be revoked.'
  })
  @ApiParam({ name: 'type', enum: ['objectives', 'key-results'], description: 'Entity type' })
  @ApiParam({ name: 'id', description: 'Entity ID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['expiresAt'],
      properties: {
        expiresAt: {
          type: 'string',
          format: 'date-time',
          description: 'ISO 8601 date string for when the share link expires',
          example: '2025-12-31T23:59:59Z'
        },
        note: {
          type: 'string',
          description: 'Optional note about the share link',
          example: 'Sharing with executive team for Q4 review'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Share link created successfully',
    schema: {
      type: 'object',
      properties: {
        shareId: { type: 'string', example: 'clx123abc456' },
        url: { type: 'string', example: 'https://app.example.com/share/clx123abc456' },
        expiresAt: { type: 'string', format: 'date-time' },
        note: { type: 'string', nullable: true }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid entity type, date format, or expiry in past' })
  @ApiResponse({ status: 403, description: 'Forbidden - user lacks permission to create share links (must be owner or tenant admin)' })
  @ApiResponse({ status: 404, description: 'Entity not found' })
  @ApiResponse({ status: 429, description: 'Too Many Requests - rate limit exceeded' })
  async createShareLink(
    @Param('type') type: string,
    @Param('id') id: string,
    @Body() body: CreateShareLinkDto,
    @Req() req: any,
  ) {
    // Normalize entity type
    let entityType: 'OBJECTIVE' | 'KEY_RESULT';
    if (type === 'objectives') {
      entityType = 'OBJECTIVE';
    } else if (type === 'key-results') {
      entityType = 'KEY_RESULT';
    } else {
      throw new BadRequestException(`Invalid entity type: ${type}. Must be 'objectives' or 'key-results'`);
    }

    // Validate user is authenticated
    if (!req.user || !req.user.id) {
      throw new BadRequestException('User not authenticated');
    }

    // Validate tenant ID
    const tenantId = req.user.tenantId;
    if (tenantId === undefined) {
      throw new BadRequestException('User organization not properly set');
    }

    // Parse expiry date
    let expiresAt: Date;
    try {
      expiresAt = new Date(body.expiresAt);
      if (isNaN(expiresAt.getTime())) {
        throw new Error('Invalid date');
      }
    } catch (error) {
      throw new BadRequestException('Invalid expiresAt date format. Use ISO 8601 format.');
    }

    return this.shareService.createShareLink({
      entityType,
      entityId: id,
      expiresAt,
      note: body.note,
      createdBy: req.user.id,
      tenantId: tenantId || null, // null for superuser
    });
  }

  /**
   * Revoke a share link.
   * 
   * DELETE /share/:shareId
   * 
   * @param shareId - Share link ID
   * @param req - Request object with user info
   */
  @Delete('share/:shareId')
  @UseGuards(JwtAuthGuard, RBACGuard, RateLimitGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Revoke a share link',
    description: 'Revokes a share link, preventing further access. Requires creator or tenant admin permissions.'
  })
  @ApiParam({ name: 'shareId', description: 'Share link ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Share link revoked successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - share link already revoked' })
  @ApiResponse({ status: 403, description: 'Forbidden - user lacks permission to revoke (must be creator or tenant admin)' })
  @ApiResponse({ status: 404, description: 'Share link not found' })
  @ApiResponse({ status: 429, description: 'Too Many Requests - rate limit exceeded' })
  async revokeShareLink(
    @Param('shareId') shareId: string,
    @Req() req: any,
  ) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('User not authenticated');
    }

    const tenantId = req.user.tenantId;
    if (tenantId === undefined) {
      throw new BadRequestException('User organization not properly set');
    }

    await this.shareService.revokeShareLink(shareId, req.user.id, tenantId || null);
    
    return { success: true };
  }

  /**
   * Resolve a share link to its entity (public endpoint).
   * 
   * GET /share/:shareId
   * 
   * This endpoint is public but tenant-safe:
   * - If user is authenticated, verifies same tenant
   * - If user is not authenticated, allows access (public share)
   * - Always checks expiry and revocation
   * 
   * @param shareId - Share link ID
   * @param req - Request object (may not have user if public)
   */
  @Get('share/:shareId')
  @Public() // Allow public access (tenant-safe)
  @ApiOperation({ 
    summary: 'Resolve a share link to its entity (public)',
    description: 'Resolves a share link to its OKR entity. This endpoint is public but tenant-safe: authenticated users must be in the same tenant, unauthenticated users can access if the link is valid and not expired. Always checks expiry and revocation status.'
  })
  @ApiParam({ name: 'shareId', description: 'Share link ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Share link resolved successfully',
    schema: {
      type: 'object',
      properties: {
        entityType: { type: 'string', enum: ['OBJECTIVE', 'KEY_RESULT'] },
        entityId: { type: 'string' },
        entity: { type: 'object', description: 'Full entity data (Objective or KeyResult with relations)' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Share link not found, expired, or revoked' })
  async resolveShareLink(
    @Param('shareId') shareId: string,
    @Req() req: any,
  ) {
    // Get tenant ID from request (set by TenantContextMiddleware for public routes)
    // If user is authenticated, use user.tenantId; otherwise use req.tenantId from middleware
    const requesterTenantId = req.user?.tenantId !== undefined 
      ? req.user.tenantId 
      : (req as any).tenantId;

    const result = await this.shareService.resolveShareLink(shareId, requesterTenantId);
    
    if (!result) {
      throw new NotFoundException('Share link not found, expired, or revoked');
    }

    return result;
  }
}

