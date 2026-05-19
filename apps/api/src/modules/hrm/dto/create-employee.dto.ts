import { IsString, IsOptional, IsEnum, IsDateString, IsNumber } from 'class-validator';
import { Gender, EmploymentType, EmployeeStatus } from '@prisma/client';

export class CreateEmployeeDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  nationalId?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  jobRole?: string;

  @IsOptional()
  @IsString()
  reportingToId?: string;

  @IsOptional()
  @IsDateString()
  joinDate?: string;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @IsOptional()
  @IsNumber()
  basicSalary?: number;

  @IsOptional()
  @IsNumber()
  houseAllowance?: number;

  @IsOptional()
  @IsNumber()
  transportAllowance?: number;

  @IsOptional()
  @IsNumber()
  medicalAllowance?: number;

  @IsOptional()
  @IsNumber()
  otherAllowance?: number;

  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @IsOptional()
  @IsString()
  emergencyPhone?: string;

  @IsOptional()
  @IsString()
  emergencyRelation?: string;
}
