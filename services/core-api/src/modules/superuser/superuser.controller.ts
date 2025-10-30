import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SuperuserService } from './superuser.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Superuser')
@Controller('superuser')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SuperuserController {
  constructor(private readonly superuserService: SuperuserService) {}

  /**
   * Check if current user is superuser
   */
  @Get('check')
  @ApiOperation({ summary: 'Check if current user is superuser' })
  async checkSuperuser(@Req() req: any) {
    const isSuper = await this.superuserService.isSuperuser(req.user.id);
    return { isSuperuser: isSuper };
  }

  /**
   * Create a new superuser (requires superuser)
   */
  @Post('create')
  @ApiOperation({ summary: 'Create a new superuser account' })
  async createSuperuser(
    @Body() data: { email: string; name: string; password: string },
    @Req() req: any,
  ) {
    // Verify requester is superuser
    const isSuper = await this.superuserService.isSuperuser(req.user.id);
    if (!isSuper) {
      throw new ForbiddenException('Only superusers can create superuser accounts');
    }

    return this.superuserService.createSuperuser(data);
  }

  /**
   * Promote user to superuser
   */
  @Post('promote/:userId')
  @ApiOperation({ summary: 'Promote user to superuser' })
  async promoteToSuperuser(@Param('userId') userId: string, @Req() req: any) {
    const isSuper = await this.superuserService.isSuperuser(req.user.id);
    if (!isSuper) {
      throw new ForbiddenException('Only superusers can promote users');
    }

    return this.superuserService.promoteToSuperuser(userId);
  }

  /**
   * Revoke superuser status
   */
  @Post('revoke/:userId')
  @ApiOperation({ summary: 'Revoke superuser status' })
  async revokeSuperuser(@Param('userId') userId: string, @Req() req: any) {
    const isSuper = await this.superuserService.isSuperuser(req.user.id);
    if (!isSuper) {
      throw new ForbiddenException('Only superusers can revoke superuser status');
    }

    // Prevent revoking your own superuser status
    if (userId === req.user.id) {
      throw new ForbiddenException('Cannot revoke your own superuser status');
    }

    return this.superuserService.revokeSuperuser(userId);
  }

  /**
   * List all superusers
   */
  @Get('list')
  @ApiOperation({ summary: 'List all superusers' })
  async listSuperusers(@Req() req: any) {
    const isSuper = await this.superuserService.isSuperuser(req.user.id);
    if (!isSuper) {
      throw new ForbiddenException('Only superusers can list superusers');
    }

    return this.superuserService.listSuperusers();
  }

  /**
   * Create organization (superuser only)
   */
  @Post('organizations')
  @ApiOperation({ summary: 'Create a new organization' })
  async createOrganization(
    @Body() data: { name: string; slug: string },
    @Req() req: any,
  ) {
    const isSuper = await this.superuserService.isSuperuser(req.user.id);
    if (!isSuper) {
      throw new ForbiddenException('Only superusers can create organizations');
    }

    return this.superuserService.createOrganization(data);
  }

  /**
   * Add user to organization (superuser only)
   */
  @Post('organizations/:organizationId/users/:userId')
  @ApiOperation({ summary: 'Add user to organization' })
  async addUserToOrganization(
    @Param('organizationId') organizationId: string,
    @Param('userId') userId: string,
    @Body() data: { role?: 'ORG_ADMIN' | 'MEMBER' | 'VIEWER' },
    @Req() req: any,
  ) {
    const isSuper = await this.superuserService.isSuperuser(req.user.id);
    if (!isSuper) {
      throw new ForbiddenException('Only superusers can assign users to organizations');
    }

    return this.superuserService.addUserToOrganization(
      userId,
      organizationId,
      data.role || 'MEMBER',
    );
  }

  /**
   * Remove user from organization (superuser only)
   */
  @Delete('organizations/:organizationId/users/:userId')
  @ApiOperation({ summary: 'Remove user from organization' })
  async removeUserFromOrganization(
    @Param('organizationId') organizationId: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    const isSuper = await this.superuserService.isSuperuser(req.user.id);
    if (!isSuper) {
      throw new ForbiddenException('Only superusers can remove users from organizations');
    }

    return this.superuserService.removeUserFromOrganization(userId, organizationId);
  }

  /**
   * List all organizations (superuser only)
   */
  @Get('organizations')
  @ApiOperation({ summary: 'List all organizations' })
  async listOrganizations(@Req() req: any) {
    const isSuper = await this.superuserService.isSuperuser(req.user.id);
    if (!isSuper) {
      throw new ForbiddenException('Only superusers can list all organizations');
    }

    return this.superuserService.listOrganizations();
  }

  /**
   * List all users (superuser only)
   */
  @Get('users')
  @ApiOperation({ summary: 'List all users in the system' })
  async listAllUsers(@Req() req: any) {
    const isSuper = await this.superuserService.isSuperuser(req.user.id);
    if (!isSuper) {
      throw new ForbiddenException('Only superusers can list all users');
    }

    return this.superuserService.listAllUsers();
  }

  /**
   * Impersonate a user (superuser only)
   */
  @Post('impersonate/:userId')
  @ApiOperation({ summary: 'Impersonate a user (superuser only)' })
  async impersonateUser(
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    const isSuper = await this.superuserService.isSuperuser(req.user.id);
    if (!isSuper) {
      throw new ForbiddenException('Only superusers can impersonate users');
    }

    return this.superuserService.impersonateUser(req.user.id, userId);
  }
}

