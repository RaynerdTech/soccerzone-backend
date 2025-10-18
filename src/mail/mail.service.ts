import { Injectable } from '@nestjs/common';
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
  async sendForgotPasswordEmail(email: string, name: string, resetLink: string) {
    await this.mailer.sendMail({
      to: email,
      subject: 'Reset Your SoccerZone Password',
      template: './forgot-password',
      context: { name, resetLink },
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
}
