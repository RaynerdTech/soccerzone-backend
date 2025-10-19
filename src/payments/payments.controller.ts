// src/payments/payments.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // Initialize payment (frontend calls this after booking)
  @Post('initialize')
  async initiatePayment(
    @Body('bookingId') bookingId: string,
    @Body('userEmail') userEmail: string,
  ) {
    return this.paymentsService.initiatePayment(bookingId, userEmail);
  }

  // Verify payment (Paystack callback / frontend calls this after redirect)
  @Post('verify')
  async verifyPayment(@Body('reference') reference: string) {
    return this.paymentsService.verifyPayment(reference);
  }
}
