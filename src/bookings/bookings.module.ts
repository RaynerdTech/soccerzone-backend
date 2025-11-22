// src/bookings/bookings.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersModule } from 'src/users/users.module';
import { MailModule } from '../mail/mail.module';
import { PaymentsModule } from '../payments/payments.module';
import { Slot, SlotSchema } from '../slots/schemas/slot.schema';
import { SlotModule } from '../slots/slot.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { Booking, BookingSchema } from './schemas/booking.schema';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule,
    UsersModule,
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
