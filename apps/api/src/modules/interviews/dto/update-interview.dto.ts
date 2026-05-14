import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { InterviewType } from '@prisma/client'

export class UpdateInterviewDto {
  @ApiPropertyOptional({ type: [String], enum: InterviewType, isArray: true })
  @IsOptional()
  @IsEnum(InterviewType, { each: true })
  types?: InterviewType[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledAt?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string
}
