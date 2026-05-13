import { IsArray, ValidateNested, IsUUID, IsInt, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

class ReorderItem {
  @IsUUID()
  id!: string

  @IsInt()
  @Min(0)
  order!: number
}

export class ReorderQuestionsDto {
  @ApiProperty({ type: [ReorderItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItem)
  updates!: ReorderItem[]
}
