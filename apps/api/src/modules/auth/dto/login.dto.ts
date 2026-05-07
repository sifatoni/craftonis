import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'oni@craftonis.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'StrongPassword123!' })
  @IsString()
  password!: string;
}
