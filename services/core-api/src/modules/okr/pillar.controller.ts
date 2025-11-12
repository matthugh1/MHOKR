import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { PillarService } from './pillar.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { CreatePillarDto } from './dto/create-pillar.dto';
import { UpdatePillarDto } from './dto/update-pillar.dto';

@ApiTags('Pillars')
@Controller('pillars')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class PillarController {
  constructor(
    private readonly pillarService: PillarService,
  ) {}

  @Post()
  @UseGuards(RateLimitGuard)
  @RequireAction('edit_okr')
  @ApiOperation({ 
    summary: 'Create strategic pillar', 
    description: 'Creates a new strategic pillar. Emits activity event (CREATED) and audit log entry.' 
  })
  @ApiResponse({ status: 201, description: 'Pillar created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input (name too long, invalid color, owner not in tenant)' })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  async create(@Body() dto: CreatePillarDto, @Req() req: any) {
    return this.pillarService.create(dto, req.user.id, req.user.tenantId);
  }

  @Get()
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'List strategic pillars', description: 'Returns all pillars for the user\'s tenant (tenant-isolated).' })
  @ApiResponse({ status: 200, description: 'List of pillars' })
  async findAll(@Req() req: any) {
    return this.pillarService.findAll(req.user.tenantId);
  }

  @Get(':id')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get pillar by ID', description: 'Returns a single pillar (tenant-isolated).' })
  @ApiResponse({ status: 200, description: 'Pillar details' })
  @ApiResponse({ status: 404, description: 'Pillar not found' })
  @ApiResponse({ status: 403, description: 'Permission denied (cross-tenant access)' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.pillarService.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @UseGuards(RateLimitGuard)
  @RequireAction('edit_okr')
  @ApiOperation({ 
    summary: 'Update strategic pillar', 
    description: 'Updates a pillar. Emits activity event (UPDATED) and audit log entry when fields change.' 
  })
  @ApiResponse({ status: 200, description: 'Pillar updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input (name too long, invalid color, owner not in tenant)' })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  @ApiResponse({ status: 404, description: 'Pillar not found' })
  async update(@Param('id') id: string, @Body() dto: UpdatePillarDto, @Req() req: any) {
    return this.pillarService.update(id, dto, req.user.id, req.user.tenantId);
  }

  @Delete(':id')
  @UseGuards(RateLimitGuard)
  @RequireAction('edit_okr')
  @ApiOperation({ 
    summary: 'Delete strategic pillar', 
    description: 'Deletes a pillar. Emits activity event (DELETED) and audit log entry.' 
  })
  @ApiResponse({ status: 200, description: 'Pillar deleted successfully' })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  @ApiResponse({ status: 404, description: 'Pillar not found' })
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.pillarService.remove(id, req.user.id, req.user.tenantId);
  }
}

