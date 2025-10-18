import { IsString, IsOptional, IsNumber, IsEnum, IsBoolean } from 'class-validator';

export class CreateSlotDto {
  @IsString()
  date: string;

  @IsString()
  startTime: string;

  @IsOptional()
  @IsString()
  endTime: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsEnum(['available', 'booked', 'unavailable'])
  status?: 'available' | 'booked' | 'unavailable';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
