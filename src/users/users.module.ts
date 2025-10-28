import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './schemas/user.schema';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema'; 
import { Slot, SlotSchema } from '../slots/schemas/slot.schema';
import { SuperAdminSeeder } from '../database/seeds/super-admin.seed';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Booking.name, schema: BookingSchema }, 
      { name: Slot.name, schema: SlotSchema }, 
    ]),
  ],
  providers: [UsersService, SuperAdminSeeder],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}