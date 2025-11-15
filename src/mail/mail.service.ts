import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MailService {
  constructor(private readonly mailer: MailerService) {}

  private async safeSendMail(options: any) {
    try {
      await this.mailer.sendMail(options);
    } catch (error) {
      console.error('💥 MAIL ERROR:', error.message);
      // DO NOT throw — prevents server crash
    }
  }

  async sendWelcomeEmail(email: string, name: string) {
    return this.safeSendMail({
      to: email,
      subject: 'Welcome To Soccerzone ',
      template: 'welcome',
      context: { name },
    });
  }

  async sendForgotPasswordEmail(email: string, name: string, token: string) {
    return this.safeSendMail({
      to: email,
      subject: 'Password Reset',
      template: 'forgot-password',
      context: { name, token },
    });
  }

  async sendResetPasswordConfirmation(email: string, name: string) {
    return this.safeSendMail({
      to: email,
      subject: 'Password Successfully Reset',
      template: 'reset-password',
      context: { name },
    });
  }

  async sendTicket(email: string, payload: any) {
    return this.safeSendMail({
      to: email,
      subject: `Booking Confirmation - ${payload.ticketId}`,
      template: 'ticket',
      context: payload,
    });
  }

  async sendOtpEmail(email: string, otp: string, verifyLink?: string) {
    return this.safeSendMail({
      to: email,
      subject: 'Your OTP Verification Code',
      html: `
        <div style="font-family: Arial; text-align:center;">
          <h2>OTP Verification</h2>
          <p>Your OTP code is:</p>
          <h1 style="color:#2563eb">${otp}</h1>
          <p>This code expires in 10 minutes.</p>
          ${
            verifyLink
              ? `<a href="${verifyLink}"
                   style="background:#2563eb;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;">
                   Verify Account
                 </a>`
              : ''
          }
        </div>
      `,
    });
  }
}
