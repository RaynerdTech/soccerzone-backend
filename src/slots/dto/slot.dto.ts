import { IsString, IsOptional, IsMongoId, IsNumber } from 'class-validator';

export class SlotDto {
  @IsString()
  date: string;

  @IsString()
  startTime: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsNumber()
  durationMins?: number;

  @IsOptional()
  @IsMongoId()
  slotId?: string;
}
