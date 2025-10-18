import { PartialType } from '@nestjs/mapped-types';
import { CreateSlotDto } from './create-slot.dto';
import { IsString, IsOptional, IsNumber, IsEnum, IsBoolean } from 'class-validator';

export class UpdateSlotDto extends PartialType(CreateSlotDto) {
  // Required to identify which slot to update
  @IsString()
  date: string;

  @IsString()
  startTime: string;

  // Optional fields to update
  @IsOptional()
  @IsString()
  endTime?: string;

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
