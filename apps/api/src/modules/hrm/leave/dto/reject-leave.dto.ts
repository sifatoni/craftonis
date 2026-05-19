import { IsNotEmpty, IsString } from 'class-validator';

export class RejectLeaveDto {
  @IsString()
  @IsNotEmpty()
  comment!: string;
}
