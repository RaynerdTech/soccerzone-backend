import {
  Controller,
  Post,
  Body,
  Param,
  Query,
  Get,
  Req,
  UseGuards,
  ForbiddenException,
  Patch,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/roles.enum';
import { BookingsService } from './bookings.service';
import { PaymentsService } from '../payments/payments.service';

interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string; role: Role };
}

@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly paymentService: PaymentsService,
  ) {}

  /** 1. Create booking + initiate payment */
  @UseGuards(JwtAuthGuard)
  @Post()
  async bookByDate(
    @Req() req: AuthenticatedRequest,
    @Query('date') date: string,
    @Body('startTimes') startTimes: string[],
  ) {
    if (!req.user) throw new ForbiddenException('Unauthorized');

    const booking = await this.bookingsService.bookByDateTime(
      req.user.id,
      date,
      startTimes,
      req.user.email,
    );

    return {
      message: booking.message,
      bookingId: booking.bookingId,
      totalAmount: booking.totalAmount,
      paymentUrl: booking.paymentUrl,
      reference: booking.paymentRef || null,
      slots: booking.slots,
    };
  }

  /** 2. Re-initiate payment */
  @UseGuards(JwtAuthGuard)
  @Post('pay/:bookingId')
  async initiatePayment(@Req() req: AuthenticatedRequest, @Param('bookingId') bookingId: string) {
    if (!req.user) throw new ForbiddenException('Unauthorized');

    const payment = await this.bookingsService.initiatePayment(bookingId, req.user.email);
    return { message: 'Payment initiated', paymentUrl: payment.paymentUrl, reference: payment.reference };
  }

  /** 3. Paystack webhook listener */
  @Post('webhook')
  async handlePaystackWebhook(@Body() payload: any) {
    if (payload.event === 'charge.success') {
      const bookingId = payload.data.reference;
      const booking = await this.bookingsService.verifyPayment(bookingId);
      return { status: 'success', booking };
    }
    return { status: 'ignored', message: 'Unhandled event type' };
  }

  /** 4. Admin: get all bookings */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('all')
  async getAllBookings() {
    const bookings = await this.bookingsService.getAllBookings();
    return { message: 'Bookings retrieved', bookings };
  }

  /** 5. Get user bookings */
  @UseGuards(JwtAuthGuard)
  @Get()
  async getUserBookings(@Req() req: AuthenticatedRequest) {
    if (!req.user) throw new ForbiddenException('Unauthorized');
    return this.bookingsService.getUserBookings(req.user.id);
  }

  /** 6. Admin: get specific user's bookings */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('user/:userId')
  async getUserBookingsByAdmin(@Param('userId') userId: string) {
    return this.bookingsService.getUserBookings(userId);
  }

  /** 7. Admin: manual payment confirmation */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post('confirm/manual')
  async confirmManualPayment(@Body('bookingId') bookingId: string) {
    const booking = await this.bookingsService.verifyPayment(bookingId);
    return { message: 'Manual payment confirmed', booking };
  }

  /** 8. Verify payment via endpoint */
  @Post('verify-payment')
  async verifyPayment(@Body('reference') reference: string) {
    const result = await this.paymentService.verifyPayment(reference);
    if (!result.success) return { success: false, statusCode: result.statusCode, message: result.message };

    const { bookingId, ticketId, slots } = result.data;
    return { success: true, statusCode: 200, message: 'Payment verified', data: { bookingId, ticketId, slots } };
  }

  /** 9. Cancel single booking */
  @UseGuards(JwtAuthGuard)
  @Patch(':bookingId/cancel')
  async cancelSingleBooking(@Param('bookingId') bookingId: string, @Req() req: any) {
    const userId = req.user.id;
    const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN].includes(req.user.role);
    return this.bookingsService.cancelBooking(bookingId, userId, isAdmin);
  }

  /** 10. Cancel multiple bookings */
  @UseGuards(JwtAuthGuard)
  @Patch('cancel/multiple')
  async cancelMultipleBookings(@Req() req: any, @Body('bookingIds') bookingIds: string[]) {
    const userId = req.user.id;
    const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN].includes(req.user.role);
    return this.bookingsService.cancelOrDeleteBookings(bookingIds, userId, isAdmin);
  }
}
