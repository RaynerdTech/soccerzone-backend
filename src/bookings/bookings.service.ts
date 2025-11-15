import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import axios from 'axios';
import { Connection, Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { CacheService } from '../cache/cache.service';
import { MailService } from '../mail/mail.service';
import { PaymentsService } from '../payments/payments.service';
import { Slot, SlotDocument } from '../slots/schemas/slot.schema';
import { SlotService } from '../slots/slot.service';
import { Booking, BookingDocument } from './schemas/booking.schema';

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
    private readonly cacheService: CacheService,
  ) {}

  /** Return default slot amount */
  getDefaultSlotAmount() {
    return this.slotService.getDefaultSlotAmount();
  }

  /** Book slots by date and time */
  async bookByDateTime(
    userId: string,
    date: string,
    startTimes: string[],
    userEmail: string,
  ) {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      if (!Array.isArray(startTimes) || !startTimes.length)
        throw new BadRequestException('Start times required');

      const slotsToBook: SlotDocument[] = [];
      const unavailableSlots: string[] = [];

      for (const startTime of startTimes) {
        let slot = await this.slotModel
          .findOne({ date, startTime })
          .session(session);

        if (!slot) {
          const endTime = this.slotService.calculateEndTime(startTime);
          slot = new this.slotModel({
            date,
            startTime,
            endTime,
            status: 'available',
            isActive: true,
            amount: this.slotService.getDefaultSlotAmount(),
          });
          await slot.save({ session });
        }

        slot.status !== 'available'
          ? unavailableSlots.push(startTime)
          : slotsToBook.push(slot);
      }

      if (unavailableSlots.length)
        throw new ConflictException(
          `Slots not available: ${unavailableSlots.join(', ')}`,
        );

      const totalAmount = slotsToBook.reduce((sum, s) => sum + s.amount, 0);
      const bookingId = uuidv4();

      await this.bookingModel.create(
        [
          {
            bookingId,
            user: userId,
            userEmail,
            slotIds: slotsToBook.map((s) => s._id),
            dates: slotsToBook.map((s) => s.date),
            startTimes: slotsToBook.map((s) => s.startTime),
            endTimes: slotsToBook.map((s) => s.endTime),
            totalAmount,
            status: 'pending',
          },
        ],
        { session },
      );

      await session.commitTransaction();

      await this.cacheService.del('all_bookings');

      const paymentInit = await this.paymentsService.initiatePayment(
        bookingId,
        userEmail,
      );
      console.log('DEBUG USER EMAIL >>>', userEmail);

      return {
        statusCode: 201,
        message: 'Booking created, payment pending',
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
      this.logger.error('Booking error', error);
      throw new InternalServerErrorException(error.message || 'Booking failed');
    } finally {
      session.endSession();
    }
  }

  /** Initialize payment for a booking */
  async initiatePayment(bookingId: string, userEmail: string) {
    const booking = await this.bookingModel.findOne({ bookingId });
    if (!booking) throw new NotFoundException('Booking not found');

    const paystackUrl = `${this.configService.get('PAYSTACK_BASE_URL')}/transaction/initialize`;
    const secretKey = this.configService.get('PAYSTACK_SECRET_KEY');
    const amountInKobo = booking.totalAmount * 100;

    const payload = {
      email: userEmail,
      amount: amountInKobo,
      reference: bookingId,
      callback_url: `${this.configService.get('FRONTEND_URL')}/booking/success`,
      metadata: { bookingId, slotIds: booking.slotIds },
    };

    try {
      const { data } = await axios.post(paystackUrl, payload, {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      if (!data.status)
        throw new InternalServerErrorException(
          `Payment init failed: ${data.message}`,
        );

      return { paymentUrl: data.data.authorization_url, reference: bookingId };
    } catch (error) {
      this.logger.error('Paystack init error', error.response?.data || error);
      throw new InternalServerErrorException('Payment initialization failed');
    }
  }

  /** Verify payment and confirm booking */
  async verifyPayment(reference: string) {
    const paystackUrl = `${this.configService.get('PAYSTACK_BASE_URL')}/transaction/verify/${reference}`;
    const secretKey = this.configService.get('PAYSTACK_SECRET_KEY');

    const { data } = await axios.get(paystackUrl, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });

    if (!data.status || data.data.status !== 'success')
      throw new BadRequestException('Payment not successful');

    const amountPaid = data.data.amount / 100;
    const booking = await this.bookingModel.findOne({ bookingId: reference });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.totalAmount !== amountPaid)
      throw new BadRequestException('Amount mismatch');

    booking.status = 'booked';
    await booking.save();

    await this.slotModel.updateMany(
      { _id: { $in: booking.slotIds } },
      { $set: { status: 'booked', bookingId: reference } },
    );
    await this.cacheService.del('all_bookings');

    return {
      message: 'Payment verified, booking confirmed',
      bookingId: booking.bookingId,
      status: 'booked',
    };
  }

  /** Get bookings of a user */
  async getUserBookings(userId: string) {
    // Fetch all slots booked by the user
    const userSlots = await this.slotModel
      .find({ bookedBy: userId })
      .sort({ date: -1 })
      .lean();
    if (!userSlots.length) {
      return {
        totalAmount: 0,
        totalBookings: 0,
        bookings: {},
      };
    }

    // Group slots by bookingId
    const bookings = userSlots.reduce(
      (acc, slot) => {
        const bookingId = slot.bookingId || 'unassigned';
        acc[bookingId] = acc[bookingId] || [];
        acc[bookingId].push({
          slotId: slot._id,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          amount: slot.amount,
          status: slot.status,
        });
        return acc;
      },
      {} as Record<string, any[]>,
    );

    // Calculate total amount and total bookings
    const totalAmount = userSlots.reduce(
      (sum, slot) => sum + (slot.amount || 0),
      0,
    );
    const totalBookings = Object.keys(bookings).length;

    return {
      totalAmount,
      totalBookings,
      bookings,
    };
  }

  /** Get all bookings with caching */
  async getAllBookings() {
    const cacheKey = 'all_bookings';
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.log('Returning bookings from cache');
      return { message: 'Bookings retrieved', bookings: cached };
    }

    // Fetch all bookings, regardless of status
    const bookings = await this.bookingModel
      .find()
      .sort({ createdAt: -1 })
      .populate('user', 'name email role') // populate user info
      .populate('slotIds') // populate slots
      .lean();

    // Structure bookings with slots and payment/ticket info
    const structured = bookings.map((booking) => ({
      bookingId: booking.bookingId,
      user: booking.user,
      totalAmount: booking.totalAmount,
      status: booking.status,
      createdAt: booking.createdAt,
      paymentRef: booking.paymentRef || null,
      paymentVerified: booking.paymentVerified || false,
      ticketId: booking.ticketId || null,
      reference: booking.reference || null,
      emailSent: booking.emailSent || false,
      slots: booking.slotIds.map((slot: any) => ({
        slotId: slot._id,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        amount: slot.amount,
        status: slot.status,
      })),
    }));

    // Cache the result (optional)
    await this.cacheService.set(cacheKey, structured, 300); // cache for 5 minutes

    return { message: 'Bookings retrieved', bookings: structured };
  }

  /** Cancel or delete bookings */
  async cancelOrDeleteBookings(
    bookingIds: string[],
    userId: string,
    isAdmin: boolean,
  ) {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      if (!bookingIds?.length)
        throw new BadRequestException('No bookings provided');

      const bookings = await this.bookingModel
        .find({ bookingId: { $in: bookingIds } })
        .session(session);
      if (!bookings.length)
        throw new NotFoundException('No matching bookings found');

      for (const booking of bookings) {
        if (!isAdmin && booking.user.toString() !== userId)
          throw new ForbiddenException('You can only cancel your own bookings');
        if (!isAdmin && booking.status !== 'pending')
          throw new BadRequestException(
            `Booking ${booking.bookingId} cannot be cancelled`,
          );

        await this.slotModel.updateMany(
          { _id: { $in: booking.slotIds } },
          { $set: { status: 'available', bookingId: null, bookedBy: null } },
          { session },
        );

        if (isAdmin)
          await this.bookingModel.deleteOne({ _id: booking._id }, { session });
        else
          await this.bookingModel.updateOne(
            { _id: booking._id },
            { $set: { status: 'cancelled' } },
            { session },
          );
      }

      await session.commitTransaction();
      await this.cacheService.del('all_bookings');

      return {
        message: `${bookings.length} booking(s) ${isAdmin ? 'deleted' : 'cancelled'} successfully.`,
      };
    } catch (error) {
      await session.abortTransaction();
      this.logger.error('Cancel/Delete error', error);
      throw new InternalServerErrorException(
        'Failed to cancel or delete bookings',
      );
    } finally {
      session.endSession();
    }
  }

  /** Cancel single booking */
  async cancelBooking(bookingId: string, userId: string, isAdmin: boolean) {
    return this.cancelOrDeleteBookings([bookingId], userId, isAdmin);
  }
}
