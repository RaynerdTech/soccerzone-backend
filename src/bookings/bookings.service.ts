import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { Booking, BookingDocument } from './schemas/booking.schema';
import { Slot, SlotDocument } from '../slots/schemas/slot.schema';
import { SlotService } from '../slots/slot.service';
import { MailService } from '../mail/mail.service';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(Slot.name) private slotModel: Model<SlotDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly configService: ConfigService,
    private readonly slotService: SlotService,
    private readonly mailService: MailService,
    private readonly paymentsService: PaymentsService,
  ) {}

  getDefaultSlotAmount() {
    return this.slotService.defaultSlotAmount;
  }

  /**
   * 1️⃣ Create booking by date and startTimes (no pending)
   */
async bookByDateTime(
  userId: string,
  date: string,
  startTimes: string[],
  userEmail: string
) {
  const session = await this.connection.startSession();
  session.startTransaction();

  try {
    if (!Array.isArray(startTimes) || startTimes.length === 0) {
      throw new BadRequestException('Start times are required.');
    }

    const slotsToBook: SlotDocument[] = [];
    const unavailableSlots: string[] = [];

    for (const startTime of startTimes) {
      let slot = await this.slotModel.findOne({ date, startTime }).session(session);

      if (!slot) {
        const endTime = this.slotService.calculateEndTime(startTime);
        slot = new this.slotModel({
          date,
          startTime,
          endTime,
          status: 'available',
          isActive: true,
          amount: this.slotService.defaultSlotAmount,
        });
        await slot.save({ session });
      }

      if (slot.status !== 'available') unavailableSlots.push(startTime);
      else slotsToBook.push(slot);
    }

    if (unavailableSlots.length > 0) {
      console.error(`Booking error: Slots not available: ${unavailableSlots.join(', ')}`);
      throw new ConflictException(`Slots not available: ${unavailableSlots.join(', ')}`);
    }

    const totalAmount = slotsToBook.reduce((sum, s) => sum + s.amount, 0);
    const bookingId = uuidv4();

    await this.bookingModel.create(
      [
        {
          bookingId,
          user: userId,
          slotIds: slotsToBook.map((s) => s._id),
          dates: slotsToBook.map((s) => s.date),
          startTimes: slotsToBook.map((s) => s.startTime),
          endTimes: slotsToBook.map((s) => s.endTime),
          totalAmount,
          status: 'pending',
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    const paymentInit = await this.paymentsService.initiatePayment(bookingId, userEmail);

    return {
      statusCode: 201, // Created
      message: 'Booking created successfully, payment pending',
      bookingId,
      totalAmount,
      status: 'pending',
      slots: slotsToBook.map((s) => ({
        slotId: s._id,
        startTime: s.startTime,
        endTime: s.endTime,
        amount: s.amount,
      })),
      paymentUrl: paymentInit.data?.authorizationUrl || null,
      paymentRef: paymentInit.data?.reference || null,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Booking error:', error);
    throw new InternalServerErrorException(error.message || 'Failed to create booking');
  }
}




  /**
   * 2️⃣ Initiate Paystack Payment (optional flow)
   */
  async initiatePayment(bookingId: string, userEmail: string) {
    const booking = await this.bookingModel.findOne({ bookingId });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'booked')
      throw new BadRequestException('Booking not eligible for payment');

    const paystackUrl = `${this.configService.get('PAYSTACK_BASE_URL')}/transaction/initialize`;
    const secretKey = this.configService.get('PAYSTACK_SECRET_KEY');
    const amountInKobo = booking.totalAmount * 100;

    const payload = {
      email: userEmail,
      amount: amountInKobo,
      reference: bookingId,
      callback_url: `${this.configService.get('FRONTEND_URL')}/booking/success`,
      metadata: {
        bookingId,
        slotIds: booking.slotIds,
      },
    };

    try {
      const response = await axios.post(paystackUrl, payload, {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
      });

      const data = response.data;
      if (!data.status) throw new InternalServerErrorException(`Payment init failed: ${data.message}`);

      return {
        paymentUrl: data.data.authorization_url,
        reference: bookingId,
      };
    } catch (error) {
      console.error('Paystack Error:', error.response?.data || error.message);
      throw new InternalServerErrorException('Paystack initialization failed');
    }
  }

  /**
   * 3️⃣ Verify Paystack Payment
   */
  async verifyPayment(reference: string) {
    const paystackUrl = `${this.configService.get('PAYSTACK_BASE_URL')}/transaction/verify/${reference}`;
    const secretKey = this.configService.get('PAYSTACK_SECRET_KEY');

    const response = await axios.get(paystackUrl, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });

    const data = response.data;
    if (!data.status) throw new BadRequestException('Payment verification failed');

    const paymentStatus = data.data.status;
    const amountPaid = data.data.amount / 100;

    if (paymentStatus !== 'success') throw new BadRequestException('Payment not successful');

    const booking = await this.bookingModel.findOne({ bookingId: reference });
    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.totalAmount !== amountPaid) {
      throw new BadRequestException('Amount mismatch');
    }

    booking.status = 'booked';
    await booking.save();

    await this.slotModel.updateMany(
      { bookingId: reference },
      { $set: { status: 'booked' } },
    );

    return {
      message: 'Payment verified and booking confirmed',
      bookingId: booking.bookingId,
      ticketId: booking.ticketId,
      emailSent: !!(booking.user as any)?.email,
      status: 'booked',
    };
  }

  /**
   * 4️⃣ Get all slots booked by a specific user
   */
  async getUserBookings(userId: string) {
    const filter = { bookedBy: userId, status: 'booked' };
    const userSlots = await this.slotModel.find(filter).sort({ date: -1 }).lean();
    if (!userSlots.length) return [];

    const grouped = userSlots.reduce((acc, slot) => {
      const bookingId = slot.bookingId || 'unassigned';
      if (!acc[bookingId]) acc[bookingId] = [];
      acc[bookingId].push(slot);
      return acc;
    }, {} as Record<string, any[]>);

    return grouped;
  }

  /**
   * 5️⃣ Get All Bookings
   */
  async getAllBookings() {
    return this.bookingModel.find({ status: 'booked' }).sort({ createdAt: -1 }).lean();
  }

  /**
 * 6️⃣ Cancel or Delete a Pending Booking (User or Admin)
 */
/**
 * Cancel or delete one or multiple bookings
 */
async cancelOrDeleteBookings(
  bookingIds: string[],
  userId: string,
  isAdmin: boolean
) {
  const session = await this.connection.startSession();
  session.startTransaction();

  try {
    if (!bookingIds || bookingIds.length === 0) {
      throw new BadRequestException('No bookings provided.');
    }

    const bookings = await this.bookingModel
      .find({ bookingId: { $in: bookingIds } })
      .session(session);

    if (!bookings.length) {
      throw new NotFoundException('No matching bookings found.');
    }

    for (const booking of bookings) {
      // ✅ Permission check for user
      if (!isAdmin && booking.user.toString() !== userId) {
        throw new ForbiddenException('You can only cancel your own bookings.');
      }

      // ✅ Status check
      if (!isAdmin && booking.status !== 'pending') {
        throw new BadRequestException(
          `Booking ${booking.bookingId} cannot be cancelled.`
        );
      }

      // ✅ Free all related slots
      await this.slotModel.updateMany(
        { _id: { $in: booking.slotIds } },
        { $set: { status: 'available', bookingId: null, bookedBy: null } },
        { session }
      );

      // ✅ Delete or cancel
      if (isAdmin) {
        await this.bookingModel.deleteOne({ _id: booking._id }, { session });
      } else {
        await this.bookingModel.updateOne(
          { _id: booking._id },
          { $set: { status: 'cancelled' } },
          { session }
        );
      }
    }

    await session.commitTransaction();
    session.endSession();

    return {
      message: `${bookings.length} booking(s) ${isAdmin ? 'deleted' : 'cancelled'} successfully.`,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    this.logger.error('Cancel/Delete error:', error);
    throw new InternalServerErrorException('Failed to cancel or delete bookings');
  }
}

/**
 * Single booking cancel wrapper (for convenience)
 */
async cancelBooking(bookingId: string, userId: string, isAdmin: boolean) {
  return this.cancelOrDeleteBookings([bookingId], userId, isAdmin);
}


}
