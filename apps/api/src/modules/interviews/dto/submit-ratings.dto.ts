import { IsObject, IsOptional, IsString, IsNumber, Min, Max } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class SubmitRatingsDto {
  @ApiProperty({
    example: {
      communication: 8,
      leadership: 7,
      culturalFit: 9,
      technicalSkill: 8,
      problemSolving: 7,
    }
  })
  @IsObject()
  ratings: Record<string, number>

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  codeSubmission?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  codeLanguage?: string
}
