import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class FeedbackQueryDto {
  @ApiPropertyOptional({ description: 'Filter by resolved status', type: Boolean })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  resolved?: boolean;

  @ApiPropertyOptional({ description: 'Filter by tenant ID' })
  @IsString()
  @IsOptional()
  tenantId?: string;

  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ description: 'Limit number of results', type: Number })
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ description: 'Offset for pagination', type: Number })
  @IsOptional()
  @Type(() => Number)
  offset?: number;
}

