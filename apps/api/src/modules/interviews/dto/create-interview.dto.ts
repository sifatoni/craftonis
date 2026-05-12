import { IsUUID, IsEnum, IsOptional, IsString, IsDateString } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { InterviewType } from '@prisma/client'

export class CreateInterviewDto {
  @ApiProperty()
  @IsUUID()
  candidateId!: string

  @ApiProperty({ enum: InterviewType })
  @IsEnum(InterviewType)
  type!: InterviewType

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledAt?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string
}
