import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(private readonly mailer: MailerService) {}

  /** 📨 Send Welcome Email */
  async sendWelcomeEmail(email: string, name: string) {
    await this.mailer.sendMail({
      to: email,
      subject: 'Welcome to SoccerZone 🎉',
      template: './welcome', // corresponds to templates/welcome.hbs
      context: { name },
    });
  }

  /** 🔐 Send Forgot Password Email */
async sendForgotPasswordEmail(email: string, name: string, token: string) {
  await this.mailer.sendMail({
    to: email,
    subject: 'Password Reset',
    template: 'forgot-password', // handlebars template
    context: {
      name,
      token,  // <- must match the {{token}} in your template
    },
  });
}

  /** ✅ Password Reset Confirmation */
  async sendResetPasswordConfirmation(email: string, name: string) {
    await this.mailer.sendMail({
      to: email,
      subject: 'Password Successfully Reset ✅',
      template: './reset-password',
      context: { name },
    });
  }

  /** 🎫 Send Booking Ticket Email (aligned with payload structure) */
  async sendTicket(email: string, payload: {
    teamName: string;
    date: string;
    ticketId: string;
    bookings: { startTime: string; endTime: string }[];
  }) {
    await this.mailer.sendMail({
      to: email,
      subject: `Booking Confirmation - ${payload.ticketId}`,
      template: './ticket', // corresponds to templates/ticket.hbs
      context: payload,
    });
  }

async sendOtpEmail(email: string, otp: string, verifyLink?: string) {
  try {
    if (!email) throw new Error('Email is required for OTP');

    await this.mailer.sendMail({
      to: email,
      subject: 'Your OTP Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; text-align: center;">
          <h2>OTP Verification</h2>
          <p>Your verification code is:</p>
          <h1 style="color:#2563eb">${otp}</h1>
          <p>This code will expire in 10 minutes.</p>
          ${
            verifyLink
              ? `<p>You can also verify directly by clicking below:</p>
                 <a href="${verifyLink}" 
                    style="display:inline-block;background:#2563eb;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;">
                    Verify My Account
                 </a>`
              : ''
          }
        </div>
      `,
    });
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw new InternalServerErrorException('Failed to send OTP email');
  }
}


}
