import {
  Controller,
  Post,
  Body,
  Param,
  Query,
  Get,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { BookingsService } from '../bookings/bookings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/roles.enum';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: Role;
  };
}

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

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
    );

    const payment = await this.bookingsService.initiatePayment(
      booking.bookingId,
      req.user.email,
    );

    return {
      message: 'Booking created and payment initiated',
      bookingId: booking.bookingId,
      slotIds: booking.slotIds,
      totalAmount: booking.totalAmount,
      paymentUrl: payment.paymentUrl,
      reference: payment.reference,
    };
  }

  /** 2️⃣ Lock selected slots before payment */
  @UseGuards(JwtAuthGuard)
@Post('lock-slots')
async lockSlots(
  @Req() req: AuthenticatedRequest,
  @Body('slotIds') slotIds: string[] | string,
  @Body('totalAmount') totalAmount?: number,
) {
  if (!req.user) throw new ForbiddenException('Unauthorized');

  const slotsArray = Array.isArray(slotIds) ? slotIds : [slotIds];
  // If not passed from frontend, compute using global slot amount
  const computedAmount =
    totalAmount ??
    slotsArray.length * this.bookingsService.getDefaultSlotAmount();

  const booking = await this.bookingsService.lockSlots(
    req.user.id,
    slotsArray,
    computedAmount,
  );

  return { message: 'Slots locked successfully', booking };
}

  /** 3️⃣ Re-initiate payment for an existing booking */
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

  /** 4️⃣ Paystack Webhook Listener */
  @Post('webhook')
  async handlePaystackWebhook(
    @Body() payload: any,
    @Query('signature') signature: string,
  ) {
    const isValid = await this.bookingsService.verifyPaystackSignature(
      payload,
      signature,
    );

    if (!isValid)
      return { status: 'error', message: 'Invalid Paystack signature' };

    if (payload.event === 'charge.success') {
      const bookingId = payload.data.reference;
      const amountPaid = payload.data.amount / 100;

      const booking = await this.bookingsService.processSuccessfulPayment(
        bookingId,
        amountPaid,
      );

      return { status: 'success', booking };
    }

    return { status: 'ignored', message: 'Unhandled event type' };
  }

  /** 5️⃣ Get all bookings (Admin only) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get()
  async getAllBookings(@Query('status') status?: string) {
    const bookings = await this.bookingsService.getAllBookings(status);
    return { message: 'Bookings retrieved successfully', bookings };
  }

  // /** 6️⃣ Admin: manually mark booking as complete */
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  // @Post('complete/:bookingId')
  // async completeBooking(@Param('bookingId') bookingId: string) {
  //   const booking = await this.bookingsService.completeBooking(bookingId);
  //   return { message: 'Booking completed successfully', booking };
  // }

  /** 7️⃣ Admin: manually confirm payment */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post('confirm/manual')
  async confirmManualPayment(@Body('bookingId') bookingId: string) {
    const booking = await this.bookingsService.confirmPaymentManually(bookingId);
    return { message: 'Manual payment confirmed', booking };
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getUserBookings(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: string,
  ) {
    const userId = req.user!.id;
    return this.bookingsService.getUserBookings(userId, status);
  }

    // ✅ Admin: View a specific user's booking history
@UseGuards(JwtAuthGuard, RolesGuard)
@Get('user/:userId')
async getUserBookingsByAdmin(
  @Param('userId') userId: string,
  @Query('status') status?: string,
) {
  return this.bookingsService.getUserBookings(userId, status);
}

}
