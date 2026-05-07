import { IsEmail, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class InviteMemberDto {
  @ApiProperty({ example: 'newmember@company.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: Role, example: Role.HR_MANAGER })
  @IsEnum(Role)
  role!: Role;
}
