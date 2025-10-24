// src/payments/payments.controller.ts
import {
  Controller,
  Post,
  Body,
  Query,
  Get,
  HttpCode,
  Req,
  Res,
  Headers,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initialize')
  async initiatePayment(
    @Body('bookingId') bookingId: string,
    @Body('userEmail') userEmail: string,
  ): Promise<any> {
    return this.paymentsService.initiatePayment(bookingId, userEmail);
  }

  @Post('verify')
  async verifyPayment(
    @Body('reference') reference: string,
    @Query('reference') qRef?: string,
  ) {
    return this.paymentsService.verifyPayment((reference || qRef)!);
  }

  @Get('booking/success')
  async bookingSuccess(@Query('reference') reference: string): Promise<any> {
    const result = await this.paymentsService.verifyPayment(reference);

    if (!result.success) {
      return {
        success: false,
        statusCode: result.statusCode,
        message: result.message,
      };
    }

    const { bookingId, ticketId, slots } = result.data;
    return {
      success: true,
      statusCode: 200,
      message: 'Payment verified, booking confirmed, ticket sent',
      data: {
        bookingId,
        ticketId,
        slots,
      },
    };
  }

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Req() req,
    @Res() res,
    @Headers('x-paystack-signature') signature: string,
  ) {
    try {
      const verified = this.paymentsService.verifyPaystackSignature(req.body, signature);
      if (!verified) {
        return res.status(400).send('Invalid signature');
      }

      const event = req.body;

      if (event.event === 'charge.success') {
        const reference = event.data.reference;
        await this.paymentsService.verifyPayment(reference, true);
      }

      return res.status(200).send('Webhook received');
    } catch (err) {
      console.error('Webhook error:', err);
      return res.status(500).send('Internal Server Error');
    }
  }


  // GET /payments/booking/details?reference=xyz
@Get('booking/details')
async getBookingDetails(@Query('reference') reference: string): Promise<any> {
  if (!reference) {
    return {
      success: false,
      statusCode: 400,
      message: 'Missing reference',
    };
  }

  const booking = await this.paymentsService.getBookingByReference(reference);

  if (!booking) {
    return {
      success: false,
      statusCode: 404,
      message: 'No booking found for this payment reference',
    };
  }

  return {
    success: true,
    statusCode: 200,
    message: 'Booking details retrieved successfully',
    data: {
      bookingId: booking.bookingId,
      ticketId: booking.ticketId,
      slots: booking.slots,
    },
  };
}

}
