// src/bookings/bookings.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { Booking, BookingSchema } from './schemas/booking.schema';
import { Slot, SlotSchema } from '../slots/schemas/slot.schema';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { SlotModule } from '../slots/slot.module';
import { MailModule } from '../mail/mail.module';
import { PaymentsModule } from '../payments/payments.module';



@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule,
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: Slot.name, schema: SlotSchema },
    ]),
    SlotModule,
    MailModule,
    PaymentsModule,
  ],
  exports: [MongooseModule],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
