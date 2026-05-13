import { IsOptional, IsString, IsInt, Min } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class UpdateQuestionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  text?: string

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
