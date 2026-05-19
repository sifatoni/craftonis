import { IsString, IsDateString, IsEnum, IsOptional } from 'class-validator';
import { HolidayType } from '@prisma/client';

export class CreateHolidayDto {
  @IsString()
  name: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsEnum(HolidayType)
  type?: HolidayType;
}
