import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection, ClientSession, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { Booking, BookingDocument } from './schemas/booking.schema';
import { Slot, SlotDocument } from '../slots/schemas/slot.schema';
import * as crypto from 'crypto';
import { SlotService } from '../slots/slot.service';
import { MailService } from '../mail/mail.service';

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
  ) {}


  getDefaultSlotAmount() {
    return this.slotService.defaultSlotAmount;
  }
  /**
   * 1️⃣ Create booking by date and startTimes
   */
  async bookByDateTime(userId: string, date: string, startTimes: string[]) {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const slotsToBook: SlotDocument[] = [];

      for (const startTime of startTimes) {
        let slot = await this.slotModel.findOne({ date, startTime }).session(
          session,
        );

        // Create slot if not existing
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

        if (slot.status !== 'available') {
          throw new ConflictException(`Slot not available: ${startTime}`);
        }

        slotsToBook.push(slot);
      }

      const totalAmount = slotsToBook.reduce((sum, s) => sum + s.amount, 0);
      const bookingId = uuidv4();

      // Mark slots as pending
      await this.slotModel.updateMany(
        { _id: { $in: slotsToBook.map((s) => s._id) } },
        { $set: { status: 'pending', bookingId, bookedBy: userId } },
        { session },
      );

      // Create booking
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
        { session },
      );

      await session.commitTransaction();
      session.endSession();

      return {
        bookingId,
        slotIds: slotsToBook.map((s) => (s._id as Types.ObjectId).toString()),
        totalAmount,
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  /**
   * 2️⃣ Lock slots before payment
   */
  async lockSlots(userId: string, slotIds: string[], totalAmount: number) {
    const bookingId = uuidv4();
    const now = new Date();

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const overlapping = await this.slotModel
        .find({
          _id: { $in: slotIds },
          status: { $in: ['pending', 'booked'] },
        })
        .session(session);

      if (overlapping.length > 0) {
        throw new ConflictException('Some slots are already booked or pending');
      }

      await this.slotModel.updateMany(
        { _id: { $in: slotIds } },
        { $set: { status: 'pending', bookingId, bookedBy: userId } },
        { session },
      );

      const booking = await this.bookingModel.create(
        [{ bookingId, user: userId, slotIds, totalAmount, status: 'pending' }],
        { session },
      );

      await session.commitTransaction();
      session.endSession();

      return booking[0];
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  }

  /**
   * 3️⃣ Initiate Paystack Payment
   */
  async initiatePayment(bookingId: string, userEmail: string) {
    const booking = await this.bookingModel.findOne({ bookingId });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'pending')
      throw new BadRequestException('Booking not pending');

    const paystackUrl = `${this.configService.get(
      'PAYSTACK_BASE_URL',
    )}/transaction/initialize`;

    const secretKey = this.configService.get('PAYSTACK_SECRET_KEY');

    const payload = {
      email: userEmail,
      amount: booking.totalAmount * 100, // Paystack expects amount in kobo
      reference: bookingId,
      callback_url: `${this.configService.get('FRONTEND_URL')}/booking/success`,
      metadata: { bookingId, slotIds: booking.slotIds },
    };

    const response = await axios.post(paystackUrl, payload, {
  headers: {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/json',
  },
});

// ✅ Safe cast
const data = response.data as {
  status: boolean;
  message: string;
  data: { authorization_url: string };
};

if (!data.status)
  throw new InternalServerErrorException('Failed to initiate payment');

return {
  paymentUrl: data.data.authorization_url,
  reference: bookingId,
};

  }

  /**
   * 4️⃣ Verify Paystack Signature
   */
  async verifyPaystackSignature(payload: any, signature: string): Promise<boolean> {
    const secret = this.configService.get('PAYSTACK_SECRET_KEY');
    const hash = crypto.createHmac('sha512', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    return hash === signature;
  }

  /**
   * 5️⃣ Process Paystack Successful Payment
   */
  async processSuccessfulPayment(bookingId: string, amountPaid: number) {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const booking = await this.bookingModel.findOne({ bookingId }).session(session);
      if (!booking) throw new NotFoundException('Booking not found');

      if (booking.status === 'confirmed') {
        await session.abortTransaction();
        session.endSession();
        return booking;
      }

      if (booking.totalAmount !== amountPaid)
        throw new BadRequestException('Payment amount mismatch');

      booking.status = 'confirmed';
      await booking.save({ session });

      await this.slotModel.updateMany(
        { _id: { $in: booking.slotIds } },
        { $set: { status: 'booked' } },
        { session },
      );

      await session.commitTransaction();
      session.endSession();

      return booking;
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  }

  /**
   * 6️⃣ Manual Payment Confirmation
   */

  private generateTicketId(): string {
    const requiredLetters = ['S', 'C', 'Z'];
    const numbers = '0123456789'.split('');
    const chars: string[] = [];

    // add required letters first
    chars.push(...requiredLetters);

    // fill the remaining 6 slots with random numbers
    for (let i = 0; i < 6; i++) {
      chars.push(numbers[Math.floor(Math.random() * numbers.length)]);
    }

    // shuffle the array to mix letters and numbers
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    return chars.join('');
  }

  async confirmPaymentManually(bookingId: string) {
    const booking = await this.bookingModel
      .findOne({ bookingId })
      .populate('user', 'name email')
      .lean();

    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.status === 'confirmed') {
      return { success: true, message: 'Booking already confirmed', bookingId };
    }

    await this.bookingModel.updateOne(
      { bookingId },
      { $set: { status: 'confirmed' } },
    );

    await this.slotModel.updateMany(
      { _id: { $in: booking.slotIds } },
      { $set: { status: 'booked' } },
    );

    const slots = await this.slotModel.find({ _id: { $in: booking.slotIds } });

    const ticketId = this.generateTicketId(); // ✅ call it as method

    const payload = {
      teamName: booking.teamName || (booking.user as any)?.name || 'Guest Team',
      date: new Date().toLocaleDateString(),
      ticketId,
      bookings: slots.map((slot) => ({
        startTime: slot.startTime,
        endTime: slot.endTime,
      })),
    };

    if ((booking.user as any)?.email) {
      await this.mailService.sendTicket((booking.user as any).email, payload);
    }

    return {
      success: true,
      message: 'Manual payment confirmed and ticket sent successfully',
      ticketId,
    };
  }


/**
 * 🔟 Get all slots booked by a specific user
 */
async getUserBookings(userId: string, status?: string) {
  const filter: any = { bookedBy: userId };

  if (status) {
    filter.status = status; // e.g., 'booked' or 'pending'
  }

  const userSlots = await this.slotModel
    .find(filter)
    .sort({ date: -1, startTime: 1 })
    .lean();

  if (!userSlots || userSlots.length === 0) {
    return [];
  }

  // Optional: group by bookingId to make result cleaner
  const grouped = userSlots.reduce((acc, slot) => {
    const bookingId = slot.bookingId || 'unassigned';
    if (!acc[bookingId]) acc[bookingId] = [];
    acc[bookingId].push(slot);
    return acc;
  }, {} as Record<string, any[]>);

  return grouped;
}




  /**
   * 8️⃣ Get All Bookings
   */
  async getAllBookings(status?: string) {
    const filter: any = {};
    if (status) filter.status = status;
    return this.bookingModel.find(filter).sort({ createdAt: -1 }).lean();
  }

  /**
   * 9️⃣ Release expired pending slots (cron job)
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async releaseExpiredPendingSlots() {
    const now = new Date();
    const expiredSlots = await this.slotModel.find({
      status: 'pending',
      pendingExpiresAt: { $lt: now },
    });

    for (const slot of expiredSlots) {
      slot.status = 'available';
      slot.bookingId = null;
      slot.bookedBy = null;
      slot.pendingExpiresAt = null;
      await slot.save();
      this.logger.log(`Released expired slot: ${slot._id}`);
    }
    
  }
}
