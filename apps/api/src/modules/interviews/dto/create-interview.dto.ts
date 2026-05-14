import { IsUUID, IsEnum, IsOptional, IsString, IsDateString } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { InterviewType } from '@prisma/client'

export class CreateInterviewDto {
  @ApiProperty()
  @IsUUID()
  candidateId!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  jobId?: string

  @ApiProperty({ type: [String], enum: InterviewType, isArray: true })
  @IsEnum(InterviewType, { each: true })
  types!: InterviewType[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledAt?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string
}
