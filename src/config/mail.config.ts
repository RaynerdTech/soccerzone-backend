// //
// import { join } from 'path';
// import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
// console.log(process.env.SMTP_HOST);
// console.log(process.env.SMTP_HOST);
// console.log(process.env.SMTP_PASS);


// export const mailConfig = {
//   transport: {
//     host: process.env.SMTP_HOST,
//     port: Number(process.env.SMTP_PORT) || 587,
//     secure: Number(process.env.SMTP_PORT) === 465, // true for SSL
//     auth: {
//       user: process.env.SMTP_USER,
//       pass: process.env.SMTP_PASS,
//     },
//     tls: {
//       rejectUnauthorized: false, // helps with local testing
//     },
//   },
//   defaults: {
//     from: process.env.MAIL_FROM || `"SoccerZone" <${process.env.SMTP_USER}>`,
//   },
//   template: {
//     dir: join(process.cwd(), 'src/mail/templates'),
//     adapter: new HandlebarsAdapter(),
//     options: {
//       strict: true,
//     },
//   },
// };
