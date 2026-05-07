import { IsString, IsEmail, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCandidateDto {
  @ApiProperty({ example: 'Arif Hassan' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'arif@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '+8801712345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  jobId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cvUrl?: string;
}
