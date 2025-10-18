// src/bookings/dto/initialize-payment.dto.ts
import { IsArray, IsMongoId, IsOptional, IsString, ArrayNotEmpty } from 'class-validator';

export class InitializePaymentDto {
  /** List of booking IDs to pay for */
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  bookingIds: string[];

    @IsOptional()
    @IsString()
    teamName?: string;
    }