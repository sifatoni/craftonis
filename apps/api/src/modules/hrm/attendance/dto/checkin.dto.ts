import { IsOptional, IsString, IsNumber } from 'class-validator';

export class CheckinDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lon?: number;

  @IsOptional()
  @IsString()
  locationName?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
