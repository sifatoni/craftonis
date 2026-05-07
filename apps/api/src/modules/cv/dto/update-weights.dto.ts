import { IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateWeightsDto {
  @ApiProperty({ example: 50, description: 'Skill match weight (%)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  skillMatchWeight!: number;

  @ApiProperty({ example: 20, description: 'Stability weight (%)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  stabilityWeight!: number;

  @ApiProperty({ example: 30, description: 'Education weight (%)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  educationWeight!: number;
}
