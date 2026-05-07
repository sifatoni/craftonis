import { IsOptional, IsEnum, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { JobStatus } from '@prisma/client';

export class JobQueryDto {
  @ApiPropertyOptional({ enum: JobStatus })
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
