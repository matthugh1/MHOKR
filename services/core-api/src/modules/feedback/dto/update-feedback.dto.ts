import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateFeedbackDto {
  @ApiPropertyOptional({ description: 'Mark feedback as resolved or unresolved' })
  @IsBoolean()
  @IsOptional()
  resolved?: boolean;

  @ApiPropertyOptional({ description: 'Update the feedback message' })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiPropertyOptional({ description: 'Update the page URL' })
  @IsString()
  @IsOptional()
  pageUrl?: string;
}


