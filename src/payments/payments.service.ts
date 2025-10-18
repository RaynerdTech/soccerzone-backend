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

      // 🔹 Generate a unique reference and attach it to this booking
      const reference = 'REF-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

      const paystackUrl = `${this.configService.get('PAYSTACK_BASE_URL')}/transaction/initialize`;
      const secretKey = this.configService.get('PAYSTACK_SECRET_KEY');
      const paymentRef = `${bookingId}-${Date.now()}`;

      const payload = {
        email: userEmail,
        amount: booking.totalAmount * 100,
        reference: paymentRef,
        callback_url: `${this.configService.get('FRONTEND_URL')}/booking/success`,
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

      // ✅ Save both reference and paymentRef in DB
      await this.bookingModel.updateOne(
        { bookingId },
        { $set: { paymentRef, reference } },
      );

      return {
        success: true,
        statusCode: 200,
        message: 'Payment initialized successfully',
        data: {
          authorizationUrl: data.data.authorization_url,
          reference: paymentRef,
          bookingReference: reference,
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

  /** 🔹 Verify Paystack Payment & Respond before Email */
  async verifyPayment(reference: string) {
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

      const booking = await this.bookingModel
        .findOne({ paymentRef: reference })
        .populate('user', 'name email')
        .lean();

      if (!booking) {
        return { success: false, statusCode: 404, message: 'Booking not found for this reference' };
      }

      if (booking.totalAmount !== amountPaid) {
        return {
          success: false,
          statusCode: 400,
          message: 'Amount mismatch between Paystack and booking record',
        };
      }

      // ✅ Update booking and slots
      await this.bookingModel.updateOne(
        { paymentRef: reference },
        { $set: { status: 'confirmed' } },
      );

      await this.slotModel.updateMany(
        { _id: { $in: booking.slotIds } },
        { $set: { status: 'booked' } },
      );

      const slots = await this.slotModel.find({ _id: { $in: booking.slotIds } });
      const ticketId = this.generateTicketId();

      // ✅ Prepare response payload
      const responsePayload = {
        success: true,
        statusCode: 200,
        message: 'Payment verified and booking confirmed successfully',
        data: {
          bookingId: booking.bookingId,
          ticketId,
          amount: booking.totalAmount,
          currency: 'NGN',
          emailSent: !!(booking.user as any)?.email,
          slots: slots.map((s) => ({
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            status: s.status,
          })),
        },
      };

      // ✅ Send confirmation email (non-blocking)
      if ((booking.user as any)?.email) {
        const payload = {
          teamName: booking.teamName || (booking.user as any)?.name || 'Guest Team',
          date: new Date().toLocaleDateString(),
          ticketId,
          bookings: slots.map((slot) => ({
            startTime: slot.startTime,
            endTime: slot.endTime,
          })),
        };

        this.mailService.sendTicket((booking.user as any).email, payload).catch((mailErr) => {
          console.error('Email send error:', mailErr.message);
        });
      }

      return responsePayload;
    } catch (err) {
      console.error('Paystack verify error:', err.response?.data || err.message);
      return {
        success: false,
        statusCode: err.response?.status || 500,
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

    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    return chars.join('');
  }
}
