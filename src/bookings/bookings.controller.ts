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
  Delete,
  Patch,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/roles.enum';
import { BookingsService } from './bookings.service';
import { PaymentsService } from '../payments/payments.service';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: Role;
  };
}

@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly paymentService: PaymentsService,
  ) {}

  /** 1️⃣ Create a new booking and auto-initiate payment */
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
    slots: booking.slots, // ✅ added slot details
  };
}


  /** 2️⃣ Re-initiate payment for an existing booking */
  @UseGuards(JwtAuthGuard)
  @Post('pay/:bookingId')
  async initiatePayment(
    @Req() req: AuthenticatedRequest,
    @Param('bookingId') bookingId: string,
  ) {
    if (!req.user) throw new ForbiddenException('Unauthorized');

    const payment = await this.bookingsService.initiatePayment(
      bookingId,
      req.user.email,
    );

    return {
      message: 'Payment initiated successfully',
      paymentUrl: payment.paymentUrl,
      reference: payment.reference,
    };
  }

  /** 3️⃣ Paystack Webhook Listener */
  @Post('webhook')
  async handlePaystackWebhook(@Body() payload: any) {
    if (payload.event === 'charge.success') {
      const bookingId = payload.data.reference;
      const amountPaid = payload.data.amount / 100;

      const booking = await this.bookingsService.verifyPayment(bookingId);

      return { status: 'success', booking };
    }

    return { status: 'ignored', message: 'Unhandled event type' };
  }

  /** 4️⃣ Get all bookings (Admin only) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('all')
  async getAllBookings() {
    const bookings = await this.bookingsService.getAllBookings();
    return { message: 'Bookings retrieved successfully', bookings };
  }

  /** 5️⃣ Get user’s own bookings */
  @UseGuards(JwtAuthGuard)
  @Get()
  async getUserBookings(@Req() req: AuthenticatedRequest) {
    if (!req.user) throw new ForbiddenException('Unauthorized');
    return this.bookingsService.getUserBookings(req.user.id);
  }

  /** 6️⃣ Admin: View a specific user's booking history */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('user/:userId')
  async getUserBookingsByAdmin(@Param('userId') userId: string) {
    return this.bookingsService.getUserBookings(userId);
  }

  /** 7️⃣ Manual payment confirmation (Admin) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post('confirm/manual')
  async confirmManualPayment(@Body('bookingId') bookingId: string) {
    // If you plan to add this method later in your service
    const booking = await this.bookingsService.verifyPayment(bookingId);
    return { message: 'Manual payment confirmed', booking };
  }

 /** 8️⃣ Verify Payment Manually (via endpoint) */
@Post('verify-payment')
async verifyPayment(@Body('reference') reference: string): Promise<any> {
  const result = await this.paymentService.verifyPayment(reference);

  if (!result.success) {
    return {
      success: false,
      statusCode: result.statusCode,
      message: result.message,
    };
  }

  // result.data exists
  const { bookingId, ticketId, slots } = result.data;

  return {
    success: true,
    statusCode: 200,
    message: 'Payment verified and booking confirmed',
    data: {
      bookingId,
      ticketId,
      slots,
    },
  };
}


@UseGuards(JwtAuthGuard)
@Patch(':bookingId/cancel')
async cancelSingleBooking(
  @Param('bookingId') bookingId: string,
  @Req() req: any
) {
  const userId = req.user.id;
  const isAdmin =
    req.user.role === Role.ADMIN || req.user.role === Role.SUPER_ADMIN;

  return this.bookingsService.cancelBooking(bookingId, userId, isAdmin);
}

/**
 * Cancel or delete multiple bookings at once
 * Body: { bookingIds: string[] }
 */
@UseGuards(JwtAuthGuard)
@Patch('cancel/multiple')
async cancelMultipleBookings(@Req() req: any, @Body('bookingIds') bookingIds: string[]) {
  const userId = req.user.id;
  const isAdmin =
    req.user.role === Role.ADMIN || req.user.role === Role.SUPER_ADMIN;

  return this.bookingsService.cancelOrDeleteBookings(bookingIds, userId, isAdmin);
}




}
