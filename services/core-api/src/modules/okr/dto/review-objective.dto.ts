import { IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReviewObjectiveDto {
  @ApiProperty({
    description: 'Confidence level (0-100)',
    example: 75,
    minimum: 0,
    maximum: 100,
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Confidence must be a number' })
  @Min(0, { message: 'Confidence must be >= 0' })
  @Max(100, { message: 'Confidence must be <= 100' })
  confidence?: number;

  @ApiProperty({
    description: 'Optional review note',
    example: 'On track, but need to accelerate Q2 initiatives',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;
}


