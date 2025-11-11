import { IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const MAX_LINK_WEIGHT = parseFloat(process.env.OKR_MAX_LINK_WEIGHT || '3.0');

export const MAX_WEIGHT = MAX_LINK_WEIGHT;

export class UpdateWeightDto {
  @ApiProperty({
    description: 'Weight for the Key Result link (0.0 to 3.0)',
    example: 1.5,
    minimum: 0,
    maximum: MAX_LINK_WEIGHT,
  })
  @IsNumber({}, { message: 'Weight must be a number' })
  @Min(0, { message: 'Weight must be >= 0' })
  @Max(MAX_LINK_WEIGHT, { message: `Weight must be <= ${MAX_LINK_WEIGHT}` })
  weight!: number;
}

