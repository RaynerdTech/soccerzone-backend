import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { MailService } from '../mail/mail.service';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  // ✅ Signup with welcome email
  async signup(dto: SignupDto) {
    const user = await this.usersService.createUser(dto);

    // send welcome mail
    await this.mailService.sendWelcomeEmail(user.email, user.name);

    const payload = { sub: user._id, role: user.role };
    const token = this.jwtService.sign(payload);
    return { user, token };
  }

  // ✅ Signin
  async signin(dto: SigninDto) {
    const user = await this.usersService.findByEmailOrPhone(dto.identifier);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

    const payload = { sub: user._id, role: user.role, email: user.email };
    const token = this.jwtService.sign(payload);
    return { user, token };
  }

  // ✅ Forgot password - sends reset link with token
  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');

    // Generate a temporary token
    const token = randomBytes(32).toString('hex');

    // Save the token and expiry (e.g., 1 hour) in user document
    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 3600 * 1000); // 1 hour
    await user.save();

    // Send forgot-password email
   const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  await this.mailService.sendForgotPasswordEmail(user.email, user.name, resetLink);

    return { message: 'Password reset link sent to your email' };
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
}
