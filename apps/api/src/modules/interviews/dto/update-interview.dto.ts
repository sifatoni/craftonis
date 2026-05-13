import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { InterviewType } from '@prisma/client'

export class UpdateInterviewDto {
  @ApiPropertyOptional({ enum: InterviewType })
  @IsOptional()
  @IsEnum(InterviewType)
  type?: InterviewType

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledAt?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string
}
