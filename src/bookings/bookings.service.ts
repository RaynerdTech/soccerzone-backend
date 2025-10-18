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
    const unavailableSlots: string[] = []; // To keep track of unavailable start times

    // Check if startTimes is an array and not empty
    if (!Array.isArray(startTimes) || startTimes.length === 0) {
      throw new BadRequestException('Invalid input: Start times are required.');
    }

    for (const startTime of startTimes) {
      // Check if a valid slot exists for the given date and start time
      let slot = await this.slotModel.findOne({ date, startTime }).session(session);

      if (!slot) {
        // If the slot does not exist, create a new slot
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

      // If the slot is already booked, add to unavailable slots list
      if (slot.status !== 'available') {
        unavailableSlots.push(startTime); // Add to list of unavailable slots
      } else {
        slotsToBook.push(slot); // Otherwise, add the slot to the booking list
      }
    }

    // If there are any unavailable slots, throw a conflict exception
    if (unavailableSlots.length > 0) {
      throw new ConflictException(`Slots not available: ${unavailableSlots.join(', ')}`);
    }

    // Calculate the total amount for the booking
    const totalAmount = slotsToBook.reduce((sum, s) => sum + s.amount, 0);
    const bookingId = uuidv4();

    // Mark the slots as pending in the database
    await this.slotModel.updateMany(
      { _id: { $in: slotsToBook.map((s) => s._id) } },
      { $set: { status: 'pending', bookingId, bookedBy: userId } },
      { session },
    );

    // Create the booking entry in the database
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

    // Commit the transaction if everything is successful
    await session.commitTransaction();
    session.endSession();

    // Return the booking details
    return {
      bookingId,
      slotIds: slotsToBook.map((s) => (s._id as Types.ObjectId).toString()),
      totalAmount,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    // Handle specific error types and provide appropriate messages and status codes
    if (error instanceof BadRequestException) {
      throw error; // Already handled at the start
    } else if (error instanceof ConflictException) {
      throw error; // Already handled when the slot is not available
    } else if (error instanceof NotFoundException) {
      throw new NotFoundException('Slot or booking data not found.');
    } else if (error instanceof InternalServerErrorException) {
      throw new InternalServerErrorException('Internal server error while booking the slot.');
    } else {
      // Catch any other unhandled errors
      console.error('Unexpected error:', error);
      throw new InternalServerErrorException('An unexpected error occurred. Please try again later.');
    }
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

  const paystackUrl = `${this.configService.get('PAYSTACK_BASE_URL')}/transaction/initialize`;
  const secretKey = this.configService.get('PAYSTACK_SECRET_KEY');

  // ✅ Convert Naira → Kobo
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

    const data = response.data as {
      status: boolean;
      message: string;
      data: { authorization_url: string };
    };

    if (!data.status) {
      throw new InternalServerErrorException(
        `Failed to initiate payment: ${data.message}`,
      );
    }

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
   * 4️⃣ Verify Paystack Signature
   */
  async verifyPaystackSignature(payload: any, signature: string): Promise<boolean> {
    const secret = this.configService.get('PAYSTACK_SECRET_KEY');
    const hash = crypto.createHmac('sha512', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    return hash === signature;
  }


  async verifyPayment(reference: string) {
  const paystackUrl = `${this.configService.get(
    'PAYSTACK_BASE_URL',
  )}/transaction/verify/${reference}`;

  const secretKey = this.configService.get('PAYSTACK_SECRET_KEY');

  const response = await axios.get(paystackUrl, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
  });

  const data = response.data;

  if (!data.status) {
    throw new BadRequestException('Payment verification failed');
  }

  const paymentStatus = data.data.status; // 'success', 'failed', etc.
  const amountPaid = data.data.amount / 100; // Paystack returns amount in kobo

  if (paymentStatus !== 'success') {
    throw new BadRequestException('Payment not successful');
  }

  // ✅ Find the booking using the reference (which is bookingId)
  const booking = await this.bookingModel.findOne({ bookingId: reference });
  if (!booking) throw new NotFoundException('Booking not found');

  // ✅ Check amount matches (optional)
  if (booking.totalAmount !== amountPaid) {
    throw new BadRequestException('Amount mismatch');
  }

  // ✅ Update booking and slots
  booking.status = 'confirmed';
  await booking.save();

  await this.slotModel.updateMany(
    { bookingId: reference },
    { $set: { status: 'booked' } },
  );

  return {
    message: 'Payment verified and booking confirmed',
    bookingId: booking.bookingId,
    totalAmount: booking.totalAmount,
    status: booking.status,
  };
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
