import { IsUUID, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScoreCvDto {
  @ApiProperty()
  @IsUUID()
  candidateId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  jobId?: string;
}
