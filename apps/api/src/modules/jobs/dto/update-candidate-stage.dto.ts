import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CandidateStage } from '@prisma/client';

export class UpdateCandidateStageDto {
  @ApiProperty({ enum: CandidateStage })
  @IsEnum(CandidateStage)
  stage!: CandidateStage;
}
