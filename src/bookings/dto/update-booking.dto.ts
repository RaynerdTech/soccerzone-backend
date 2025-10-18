// src/bookings/dto/update-booking.dto.ts
import { IsOptional, IsEnum } from 'class-validator';

export enum BookingStatus {
  BOOKED = 'booked',
  PENDING = 'pending',
  CANCELLED = 'cancelled',
}

export class UpdateBookingDto {
  @IsOptional()
  pitch?: string;

  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  notes?: string;
}
