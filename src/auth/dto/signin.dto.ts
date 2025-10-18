import { IsNotEmpty, IsString } from 'class-validator';

export class SigninDto {
  @IsNotEmpty()
  @IsString()
  identifier: string; // email, phone, or name

  @IsNotEmpty()
  @IsString()
  password: string;
}
