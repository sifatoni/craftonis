import { IsString, IsOptional, IsInt, IsEnum, MinLength, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobStatus } from '@prisma/client';

export class CreateJobDto {
  @ApiProperty({ example: 'Senior Frontend Engineer' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  title!: string;

  @ApiPropertyOptional({ example: 'We are looking for...' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'TypeScript, React, 3+ years' })
  @IsOptional()
  @IsString()
  requirements?: string;

  @ApiPropertyOptional({ example: 'dept-uuid-here' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMin?: number;

  @ApiPropertyOptional({ example: 80000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMax?: number;
}
