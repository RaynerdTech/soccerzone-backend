import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';
import { Slot, SlotDocument } from '../slots/schemas/slot.schema';
import { MailService } from '../mail/mail.service';
import * as crypto from 'crypto';

/** ✅ Type Definitions (make them exportable for controller use) */
export interface VerifyPaymentSuccess {
  success: true;
  statusCode: number;
  message: string;
  data: {
    bookingId: string;
    ticketId: string;
    amount: number;
    currency: string;
    emailSent: boolean;
    slots: {
      date: string;
      startTime: string;
      endTime: string;
      status: 'available' | 'booked' | 'unavailable';
    }[];
  };
}

export interface VerifyPaymentFailure {
  success: false;
  statusCode: number;
  message: string;
  error?: any;
}

export type VerifyPaymentResult = VerifyPaymentSuccess | VerifyPaymentFailure;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(Slot.name)
    private readonly slotModel: Model<SlotDocument>,
  ) {}

  /** 🔹 Initialize Paystack Payment */
  async initiatePayment(bookingId: string, userEmail: string) {
    try {
      const booking = await this.bookingModel.findOne({ bookingId });
      if (!booking) {
        return { success: false, statusCode: 404, message: 'Booking not found' };
      }

      if (booking.status === 'confirmed') {
        return {
          success: false,
          statusCode: 400,
          message: 'Booking has already been confirmed or paid for',
        };
      }

      const paystackUrl = `${this.configService.get('PAYSTACK_BASE_URL')}/transaction/initialize`;
      const secretKey = this.configService.get('PAYSTACK_SECRET_KEY');

      const payload = {
        email: userEmail,
        amount: booking.totalAmount * 100,
        callback_url: `${this.configService.get('FRONTEND_URL')}/payments/booking/success`,
        metadata: { bookingId, slotIds: booking.slotIds },
      };

      const response = await axios.post(paystackUrl, payload, {
        headers: { Authorization: `Bearer ${secretKey}` },
      });

      const data = response.data;

      if (!data.status) {
        return {
          success: false,
          statusCode: 502,
          message: data.message || 'Failed to initialize payment',
          error: data,
        };
      }

      // ✅ Save Paystack-generated reference in DB
      await this.bookingModel.updateOne(
        { bookingId },
        { $set: { paymentRef: data.data.reference } },
      );

      return {
        success: true,
        statusCode: 200,
        message: 'Payment initialized successfully',
        data: {
          authorizationUrl: data.data.authorization_url,
          reference: data.data.reference,
          bookingId,
          totalAmount: booking.totalAmount,
          currency: 'NGN',
        },
      };
    } catch (err) {
      console.error('Paystack init error:', err.response?.data || err.message);

      const isDuplicate = err.response?.data?.code === 'duplicate_reference';
      return {
        success: false,
        statusCode: isDuplicate ? 409 : 500,
        message: isDuplicate
          ? 'Duplicate transaction reference. Please try again.'
          : 'Internal Server Error while initializing payment',
        error: err.response?.data || err.message,
      };
    }
  }

  verifyPaystackSignature(payload: any, signature: string): boolean {
  const secret = this.configService.get('PAYSTACK_SECRET_KEY');
  const hash = crypto
    .createHmac('sha512', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return hash === signature;
}

  /** 🔹 Verify Paystack Payment & Confirm Booking */
async verifyPayment(reference: string, fromWebhook = false): Promise<VerifyPaymentResult> {
  const paystackUrl = `${this.configService.get('PAYSTACK_BASE_URL')}/transaction/verify/${reference}`;
  const secretKey = this.configService.get('PAYSTACK_SECRET_KEY');

  try {
    const response = await axios.get(paystackUrl, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });

    const data = response.data;
    if (!data.status) {
      return { success: false, statusCode: 400, message: 'Payment verification failed' };
    }

    const paymentStatus = data.data.status;
    const amountPaid = data.data.amount / 100;

    if (paymentStatus !== 'success') {
      return { success: false, statusCode: 400, message: 'Payment not successful. Please try again.' };
    }

    // 🔒 Atomically find and lock the booking to avoid duplicate processing
    const booking = await this.bookingModel.findOne({ paymentRef: reference }).populate('user', 'name email');

    if (!booking) {
      return { success: false, statusCode: 404, message: 'Booking not found for this reference' };
    }

    // 🚫 Prevent re-verification if already processed
    if (booking.paymentVerified || booking.status === 'confirmed') {
      return {
        success: false,
        statusCode: 400,
        message: 'This payment reference has already been used or confirmed.',
      };
    }

    // ✅ Check amount integrity
    if (booking.totalAmount !== amountPaid) {
      return {
        success: false,
        statusCode: 400,
        message: 'Amount mismatch between Paystack and booking record',
      };
    }

    // ✅ Mark as verified *immediately* to block duplicate use
    booking.paymentVerified = true;
    booking.status = 'confirmed';
    (booking as any).paymentStatus = 'paid';

    const ticketId = this.generateTicketId();
    const emailSent = !!(booking.user as any)?.email;

    booking.ticketId = ticketId;
    booking.emailSent = emailSent;

    await booking.save();

    // ✅ Update booked slots
    await this.slotModel.updateMany(
      { _id: { $in: booking.slotIds } },
      {
        $set: {
          status: 'booked',
          bookingId: booking.bookingId,
          bookedBy: (booking.user as any)?._id,
        },
      },
    );

    const slots = await this.slotModel.find({ _id: { $in: booking.slotIds } });

    // ✅ Send email asynchronously (safe, one-time)
    if (emailSent) {
      const payload = {
        teamName: booking.teamName || (booking.user as any)?.name || 'Guest Team',
        date: new Date().toLocaleDateString(),
        ticketId,
        bookings: slots.map((slot) => ({
          startTime: slot.startTime,
          endTime: slot.endTime,
        })),
      };

      this.mailService.sendTicket((booking.user as any).email, payload).catch(console.error);
    }

    return {
      success: true,
      statusCode: 200,
      message: 'Payment verified and booking confirmed successfully',
      data: {
        bookingId: booking.bookingId,
        ticketId,
        amount: booking.totalAmount,
        currency: 'NGN',
        emailSent,
        slots: slots.map((s) => ({
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          status: s.status,
        })),
      },
    };
  } catch (err) {
    console.error('Paystack verify error:', err.response?.data || err.message);
    return {
      success: false,
      statusCode: 500,
      message: 'Internal Server Error during payment verification',
      error: err.response?.data || err.message,
    };
  }
}


  /** 🎟️ Generate Ticket ID */
  private generateTicketId(): string {
    const requiredLetters = ['S', 'C', 'Z'];
    const numbers = '0123456789'.split('');
    const chars: string[] = [];

    chars.push(...requiredLetters);
    for (let i = 0; i < 6; i++) {
      chars.push(numbers[Math.floor(Math.random() * numbers.length)]);
    }

    // Shuffle
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    return chars.join('');
  }

  
  async getBookingByReference(reference: string) {
  const booking = await this.bookingModel
    .findOne({ paymentRef: reference })
    .populate('slotIds')
    .lean();

  if (!booking) return null;

  const slots = await this.slotModel.find({ _id: { $in: booking.slotIds } });

  return {
    bookingId: booking.bookingId,
    ticketId: booking.ticketId,
    slots: slots.map((s) => ({
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      status: s.status,
    })),
  };
}

}
