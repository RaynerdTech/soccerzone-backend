// import { MailerService } from '@nestjs-modules/mailer';
// import { Injectable } from '@nestjs/common';

// @Injectable()
// export class MailService {
//   constructor(private readonly mailer: MailerService) {}

//   private async safeSendMail(options: any) {
//     try {
//       await this.mailer.sendMail(options);
//     } catch (error) {
//       console.error('💥 MAIL ERROR:', error.message);
//       // DO NOT throw — prevents server crash
//     }
//   }

//   async sendWelcomeEmail(email: string, name: string) {
//     return this.safeSendMail({
//       to: email,
//       subject: 'Welcome To Soccerzone ',
//       template: 'welcome',
//       context: { name },
//     });
//   }

//   async sendForgotPasswordEmail(email: string, name: string, token: string) {
//     return this.safeSendMail({
//       to: email,
//       subject: 'Password Reset',
//       template: 'forgot-password',
//       context: { name, token },
//     });
//   }

//   async sendResetPasswordConfirmation(email: string, name: string) {
//     return this.safeSendMail({
//       to: email,
//       subject: 'Password Successfully Reset',
//       template: 'reset-password',
//       context: { name },
//     });
//   }

//   async sendTicket(email: string, payload: any) {
//     return this.safeSendMail({
//       to: email,
//       subject: `Booking Confirmation - ${payload.ticketId}`,
//       template: 'ticket',
//       context: payload,
//     });
//   }

//   async sendOtpEmail(email: string, otp: string, verifyLink?: string) {
//     return this.safeSendMail({
//       to: email,
//       subject: 'Your OTP Verification Code',
//       html: `
//         <div style="font-family: Arial; text-align:center;">
//           <h2>OTP Verification</h2>
//           <p>Your OTP code is:</p>
//           <h1 style="color:#2563eb">${otp}</h1>
//           <p>This code expires in 10 minutes.</p>
//           ${
//             verifyLink
//               ? `<a href="${verifyLink}"
//                    style="background:#2563eb;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;">
//                    Verify Account
//                  </a>`
//               : ''
//           }
//         </div>
//       `,
//     });
//   }
// }

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

  // async sendWelcomeEmail(email: string, name: string) {
  //   return this.safeSendMail({
  //     to: email,
  //     subject: 'Welcome To Soccerzone ',
  //     template: 'welcome',
  //     context: { name },
  //   });
  // }

  async sendWelcomeEmail(email: string, name: string) {
    const html = `
<div style="font-family: Arial, sans-serif; background-color: #f6f7f8; padding: 20px;">
  <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 8px; overflow: hidden; border: 1px solid #ddd;">

    <!-- Header -->
    <div style="background: #004d25; padding: 16px; color: white; text-align: center;">
      <h2 style="margin: 0;">SoccerZone</h2>
      <p style="margin: 0;">Welcome On Board</p>
    </div>

    <!-- Body -->
    <div style="padding: 24px;">
      <p>Hi <strong>${name}</strong>,</p>

      <p>
        Welcome to <strong>SoccerZone</strong>. We’re pleased to have you join our sports and recreation community.
      </p>

      <p>
        With your new account, you can now:
      </p>

      <ul style="padding-left: 20px; margin-top: 8px;">
        <li>Book football matches and manage your reservations</li>
        <li>View available time slots and schedules</li>
        <li>Access our lounge, PS5 gaming area, and snooker facilities</li>
        <li>Connect and engage with other players and teams</li>
      </ul>

      <p>
        We’re committed to providing a seamless and enjoyable experience, both on and off the pitch.
        If you need any support, feel free to reach out.
      </p>

      <p style="margin-top: 20px; font-weight: bold; color: #004d25;">
        Welcome to SoccerZone.
      </p>
    </div>

    <!-- Footer -->
    <div style="background: #f6f7f8; padding: 12px; text-align: center; font-size: 13px; color: #777;">
      38 Engr David Ekundayo Hughes Street (formerly known as Ajoke Osho Street),
      off Olaniyi Street, New Oko-Oba, Ifako/Ijaiye, Lagos State.<br>
      This email was sent by <strong>SoccerZone</strong><br>
      Your trusted place for sports and recreation.
    </div>

  </div>
</div>
  `;

    return this.safeSendMail({
      to: email,
      subject: 'Welcome To Soccerzone',
      html, // Sending the HTML directly
    });
  }

  async sendSignupInviteEmail(email: string, teamName: string) {
    const html = `
<div style="font-family: Arial, sans-serif; background-color: #f6f7f8; padding: 20px;">
  <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 8px; overflow: hidden; border: 1px solid #ddd;">

    <!-- Header -->
    <div style="background: #004d25; padding: 16px; color: white; text-align: center;">
      <h2 style="margin: 0;">SoccerZone</h2>
      <p style="margin: 0;">You're Almost There!</p>
    </div>

    <!-- Body -->
    <div style="padding: 24px;">
      <p>Hi <strong>${teamName || 'Player'}</strong>,</p>

      <p>Welcome to <strong>SoccerZone</strong>! You’ve just booked a match with us.</p>

      <p>Sign up on our website to:</p>

      <ul style="padding-left: 20px; margin-top: 8px;">
        <li>Check slot availability and book matches in advance</li>
        <li>Manage all your bookings in one place</li>
        <li>Join and manage your team easily</li>
        <li>Receive updates and notifications for your matches</li>
      </ul>

      <p style="margin-top: 20px; text-align: center;">
        <a href="https://www.soccerzone.ng/signup"
           style="display: inline-block; padding: 12px 24px; background-color: #004d25; color: white; text-decoration: none; border-radius: 5px;">
          Sign Up Now
        </a>
      </p>

      <p style="margin-top: 20px; font-weight: bold; color: #004d25;">
        See you on the pitch!
      </p>
    </div>

    <!-- Footer -->
    <div style="background: #f6f7f8; padding: 12px; text-align: center; font-size: 13px; color: #777;">
      38 Engr David Ekundayo Hughes Street, Ifako/Ijaiye, Lagos State.<br>
      Sent by <strong>SoccerZone</strong>, your trusted place for sports and recreation.
    </div>

  </div>
</div>


  `;

    return this.safeSendMail({
      to: email,
      subject: 'Complete Your Registration on SoccerZone!',
      html,
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

  // async sendTicket(email: string, payload: any) {
  //   return this.safeSendMail({
  //     to: email,
  //     subject: `Booking Confirmation - ${payload.ticketId}`,
  //     template: 'ticket',
  //     context: payload,
  //   });
  // }

  async sendTicket(email: string, payload: any) {
    const html = `
<div style="font-family: Arial, sans-serif; background-color: #f6f7f8; padding: 20px;">
  <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 8px; overflow: hidden; border: 1px solid #ddd;">
    <div style="background: #004d25; padding: 16px; color: white; text-align: center;">
      <h2 style="margin: 0;">⚽ SoccerZone</h2>
      <p style="margin: 0;">Booking Confirmation</p>
    </div>
    <div style="padding: 24px;">
      <p>Hi <strong>${payload.teamName}</strong>,</p>
      <p>Your booking has been <strong style="color: green;">confirmed</strong>. Please find the details below:</p>

      <p><strong>Date:</strong> ${payload.date}</p>
      <p><strong>Ticket ID:</strong> <code>${payload.ticketId}</code></p>

      <p><strong>Booked Slots:</strong></p>

      ${payload.bookings
        .map(
          (b) => `
        <div style="background:#f2f2f2; padding:10px; margin-bottom:5px; border-radius:5px;">
          ${b.startTime} - ${b.endTime}
        </div>
      `,
        )
        .join('')}

      <p>Please present this email (or Ticket ID) at the pitch on arrival.</p>
    </div>

    <div style="background: #f6f7f8; padding: 12px; text-align: center; font-size: 13px; color: #777;">
      38 Engr David Ekundayo Hughes Street (formerly known as Ajoke Osho street), off Olaniyi Street New Oko-Oba,
      Ifako/Ijaiye Local Government Area of Lagos State.<br><br>
      This email was sent by <strong>SoccerZone</strong><br>
      Bringing your team to the pitch!
    </div>
  </div>
</div>
  `;

    return this.safeSendMail({
      to: email,
      subject: `Booking Confirmation - ${payload.ticketId}`,
      html, // <--- use HTML directly
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
