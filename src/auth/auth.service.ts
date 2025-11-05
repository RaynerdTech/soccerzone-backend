import { Injectable, UnauthorizedException, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { MailService } from '../mail/mail.service';
import { randomBytes } from 'crypto';
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Slot } from '../slots/schemas/slot.schema'; //

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    @InjectModel(Booking.name)
  private readonly bookingModel: Model<BookingDocument>,
  ) {}

 // ✅ Signup - sign user first, send email asynchronously
  async signup(dto: SignupDto) {
    // 🔍 Check for duplicate user
    const existing = await this.usersService.findByEmailOrPhone(dto.email);
    if (existing) {
      throw new BadRequestException(
        existing.email === dto.email
          ? 'Email already exists'
          : 'Phone number already exists',
      );
    }

    // 🔐 Create new user
    const user = await this.usersService.createUser(dto);

    // 🎟️ Generate token immediately
    const payload = { sub: user._id, role: user.role };
    const token = this.jwtService.sign(payload);

    // ⚡ Send welcome email *after* returning response
    setImmediate(async () => {
      try {
        await this.mailService.sendWelcomeEmail(user.email, user.name);
      } catch (error) {
        console.error('Email sending failed:', error.message);
      }
    });

    // ✅ Return response to frontend (no delay)
    return { user, token };
  }

  // ✅ Signin
async signin(dto: SigninDto) {
  try {
    // Check for user existence
    const user = await this.usersService.findByEmailOrPhone(dto.identifier);
    if (!user) {
      // Return 401 Unauthorized if user is not found
      throw new UnauthorizedException('Invalid credentials');
    }

    // Validate the password
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      // Return 401 Unauthorized if password is invalid
      throw new UnauthorizedException('Invalid credentials');
    }

    // Create payload for JWT token
    const payload = { sub: user._id, role: user.role, email: user.email };
    const token = this.jwtService.sign(payload);

    // Return success response with user and token
    return { user, token };
  } catch (error) {
    if (error instanceof UnauthorizedException) {
      // 401 Unauthorized: Invalid credentials
      throw error;
    } else if (error instanceof BadRequestException) {
      // 400 Bad Request: Validation error (could be added if you want to validate inputs)
      throw new BadRequestException('Invalid input data');
    } else if (error instanceof InternalServerErrorException) {
      // 500 Internal Server Error: Generic server error
      throw new InternalServerErrorException('An error occurred, please try again later');
    } else if (error.message === 'Network Error') {
      // Handle network errors (e.g., if request fails due to no internet or timeout)
      throw new InternalServerErrorException('Network error, please check your connection and try again');
    } else {
      // Fallback: Any unknown error
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }
}

  // ✅ Forgot password - sends reset link with token
async forgotPassword(email: string) {
  try {
    // Ensure valid email format
    if (!email || !email.includes('@')) {
      throw new BadRequestException('Invalid email format');
    }

    // Look for the user by email
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // User not found, return 404 Not Found
      throw new NotFoundException('User not found');
    }

    // Generate a temporary token for password reset
    const token = randomBytes(32).toString('hex');

    // Set the reset token and expiry time (1 hour)
    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 3600 * 1000); // 1 hour
    await user.save();

    // Generate the reset password link with the token
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    // Send the reset password email
    try {
      await this.mailService.sendForgotPasswordEmail(user.email, user.name, resetLink);
    } catch (emailError) {
      // Catch any email sending issues and return an appropriate message
      throw new InternalServerErrorException('Failed to send reset password email. Please try again later.');
    }

    // Return success message
    return { message: 'Password reset link sent to your email' };

  } catch (error) {
    if (error instanceof BadRequestException) {
      // 400 Bad Request: Invalid email format
      throw error;
    } else if (error instanceof NotFoundException) {
      // 404 Not Found: User not found
      throw error;
    } else if (error instanceof InternalServerErrorException) {
      // 500 Internal Server Error: Failed to send email or other server issues
      throw error;
    } else {
      // Catch any unknown errors
      throw new InternalServerErrorException('An unexpected error occurred. Please try again later.');
    }
  }
}


  // ✅ Reset password
  async resetPassword(token: string, newPassword: string) {
    const user = await this.usersService.findByResetToken(token);
    if (!user) throw new NotFoundException('Invalid or expired token');

    // Hash new password
    user.password = await bcrypt.hash(newPassword, 10);

    // Remove token & expiry
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    // Send confirmation email
  await this.mailService.sendResetPasswordConfirmation(user.email, user.name);

    return { message: 'Password reset successfully' };
  }
  

  async getProfile(userId: string) {
  const user = await this.usersService.findOne(userId);
  if (!user) throw new NotFoundException('User not found');

  // Ensure we have a plain JS object
  const safeUser = (({ password, resetPasswordToken, resetPasswordExpires, ...rest }) => rest)(user);

  // Fetch bookings
  const bookings = await this.bookingModel
    .find({ user: userId })
    .populate({
      path: 'slotIds',
      model: Slot.name,
      select: 'date startTime endTime amount status bookedBy',
    })
    .sort({ createdAt: -1 })
    .lean(); // make each booking a plain JS object

  const formattedBookings = bookings.map((b) => ({
    bookingId: b.bookingId,
    totalAmount: b.totalAmount,
    status: b.status,
    paymentRef: b.paymentRef,
    ticketId: b.ticketId,
    email: b.emailSent,
    createdAt: b.createdAt,
    slots: (b.slotIds as any[]).map((slot) => ({
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      amount: slot.amount,
      status: slot.status,
      bookedBy: slot.bookedBy,
    })),
  }));

  return {
    ...safeUser,
    bookings: formattedBookings,
  };
}


}
