import { PartialType } from '@nestjs/swagger';
import { CreateJobDto } from './create-job.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { JobStatus } from '@prisma/client';

export class UpdateJobDto extends PartialType(CreateJobDto) {
  @ApiPropertyOptional({ enum: JobStatus })
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;
}
