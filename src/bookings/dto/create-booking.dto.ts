import { IsArray, ArrayNotEmpty, IsString, IsOptional, IsMongoId } from 'class-validator';

export class CreateBookingDto {
   @IsString()
  date: string; // e.g., "2025-10-12"

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  startTimes: string[]; // e.g., ["08:00", "09:00", "10:00"]

  @IsOptional()
  @IsString()
  teamName?: string;
}
