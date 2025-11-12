import { IsString, IsOptional, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePillarDto {
  @ApiProperty({
    description: 'Pillar name (max 100 characters)',
    example: 'Customer Experience',
    maxLength: 100,
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @MaxLength(100, { message: 'Name must be <= 100 characters' })
  name?: string;

  @ApiProperty({
    description: 'Pillar description',
    example: 'Improve customer satisfaction and retention',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Hex color code (e.g., #FF5733)',
    example: '#FF5733',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^#([0-9A-F]{3}){1,2}$/i, { message: 'Color must be a valid hex color (e.g., #FF5733 or #F57)' })
  color?: string;

  @ApiProperty({
    description: 'Owner user ID (must belong to same tenant)',
    example: 'clx1234567890',
    required: false,
  })
  @IsOptional()
  @IsString()
  ownerId?: string | null;
}


