// import { IsArray, ArrayNotEmpty, IsString, IsOptional, IsMongoId } from 'class-validator';

// export class CreateBookingDto {
//    @IsString()
//   date: string; // e.g., "2025-10-12"

//   @IsArray()
//   @ArrayNotEmpty()
//   @IsString({ each: true })
//   startTimes: string[]; // e.g., ["08:00", "09:00", "10:00"]

//   @IsOptional()
//   @IsString()
//   teamName?: string;
// }

import {
  ArrayNotEmpty,
  IsArray,
  IsMongoId,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateBookingDto {
  @IsOptional()
  @IsMongoId()
  userId?: string; // Optional: if not provided, admin's ID is used

  @IsOptional()
  @IsString()
  userEmail?: string; // Optional

  @IsOptional()
  @IsString()
  teamName?: string; // Optional

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  startTimes: string[]; // Required: ["09:00", "10:00"]
}
