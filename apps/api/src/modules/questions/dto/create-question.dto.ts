import { IsEnum, IsOptional, IsString, IsInt, Min } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { InterviewType } from '@prisma/client'

export class CreateQuestionDto {
  @ApiProperty({ enum: InterviewType })
  @IsEnum(InterviewType)
  type!: InterviewType

  @ApiProperty()
  @IsString()
  text!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number
}
