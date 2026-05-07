import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Craftonis Inc' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  companyName!: string;

  @ApiProperty({ example: 'Oni' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name!: string;

  @ApiProperty({ example: 'oni@craftonis.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'StrongPassword123!' })
  @IsString()
  @MinLength(8)
  password!: string;
}
