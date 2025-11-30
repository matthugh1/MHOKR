import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFeedbackDto {
  @ApiProperty({ description: 'Feedback message from the user' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({ description: 'URL of the page where feedback was submitted' })
  @IsString()
  @IsNotEmpty()
  pageUrl: string;

  @ApiPropertyOptional({ description: 'User agent string' })
  @IsString()
  @IsOptional()
  userAgent?: string;

  @ApiPropertyOptional({ description: 'Array of captured errors', type: 'array', isArray: true })
  @IsOptional()
  errors?: any[];

  @ApiPropertyOptional({ description: 'Additional metadata (screen size, etc.)', type: 'object' })
  @IsOptional()
  metadata?: any;
}

