import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Model } from 'mongoose';
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';
import { MailService } from '../mail/mail.service';
import { Slot } from '../slots/schemas/slot.schema';
import { UsersService } from '../users/users.service';
import { SigninDto } from './dto/signin.dto';
import { SignupDto } from './dto/signup.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
  ) {}

  // Signup with token and welcome email
  async signup(dto: SignupDto) {
    const existing = await this.usersService.findByEmailOrPhone(dto.email);
    if (existing) {
      throw new BadRequestException(
        existing.email === dto.email
          ? 'Email already exists'
          : 'Phone number already exists',
      );
    }

    const user = await this.usersService.createUser(dto);

    const payload = {
      sub: (user as any)._id,
      role: user.role,
      email: user.email,
    };
    const token = this.jwtService.sign(payload);

    setImmediate(async () => {
      try {
        await this.mailService.sendWelcomeEmail(user.email, user.name);
      } catch (error) {
        console.error('Failed to send welcome email:', error.message);
      }
    });

    return { user, token };
  }

  // Resend OTP to user
  async resendOtp(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 5 * 60 * 1000);

    await this.usersService.updateUser(user._id as string, {
      otpCode: otp,
      otpExpires: expiry,
    });

    await this.mailService.sendOtpEmail(user.email, otp);

    return { message: 'New OTP sent successfully' };
  }

  // Signin
  async signin(dto: SigninDto) {
    const user = await this.usersService.findByEmailOrPhone(dto.identifier);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid)
      throw new UnauthorizedException('Invalid credentials');

    const payload = { sub: user._id, role: user.role, email: user.email };
    const token = this.jwtService.sign(payload);

    return { user, token };
  }

  // Forgot password
  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException('No account found with this email');

    const token = randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await this.usersService.update(user.id, {
      resetPasswordToken: token,
      resetPasswordExpires: expiry,
    });

    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;
    await this.mailService.sendForgotPasswordEmail(
      user.email,
      user.name,
      resetLink,
    );

    return { message: 'Password reset link sent to your email' };
  }

  // Reset password
  async resetPassword(token: string, newPassword: string) {
    const user = await this.usersService.findByResetToken(token);
    if (!user) throw new NotFoundException('Invalid or expired token');

    if (!user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
      throw new BadRequestException('Reset token has expired');
    }

    // const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.usersService.update(user.id, {
      password: newPassword,
      resetPasswordToken: null,
      resetPasswordExpires: null,
    });

    await this.mailService.sendResetPasswordConfirmation(user.email, user.name);

    return { message: 'Password reset successful' };
  }

  // Get user profile along with bookings
  async getProfile(userId: string) {
    const user = await this.usersService.findOne(userId);
    if (!user) throw new NotFoundException('User not found');

    const safeUser = (({
      password,
      resetPasswordToken,
      resetPasswordExpires,
      otpCode,
      otpExpires,
      ...rest
    }) => rest)(user);

    const bookings = await this.bookingModel
      .find({ user: userId })
      .populate({
        path: 'slotIds',
        model: Slot.name,
        select: 'date startTime endTime amount status bookedBy',
      })
      .sort({ createdAt: -1 })
      .lean();

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
