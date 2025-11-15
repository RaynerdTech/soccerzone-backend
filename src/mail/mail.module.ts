// src/mail/mail.module.ts
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import { join } from 'path';
import { MailService } from './mail.service';

@Module({
  imports: [
    ConfigModule,
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProd = config.get<string>('NODE_ENV') === 'production';

        // Choose correct template directory based on environment
        const templatesPath = isProd
          ? join(__dirname, 'templates') // PRODUCTION (compiled)
          : join(process.cwd(), 'src', 'mail', 'templates'); // DEV

        console.log('🧩 Templates path:', templatesPath);
        console.log('Exists:', existsSync(templatesPath));

        return {
          transport: {
            host: config.get<string>('SMTP_HOST'),
            port: parseInt(config.get<string>('SMTP_PORT') || '587', 10),
            secure: parseInt(config.get<string>('SMTP_PORT') || '') === 465,

            auth: {
              user: config.get<string>('SMTP_USER'),
              pass: config.get<string>('SMTP_PASS'),
            },
            tls: {
              rejectUnauthorized: false,
            },
          },
          defaults: {
            from: `"${config.get<string>('APP_NAME')}" <${config.get<string>('SMTP_USER')}>`,
          },
          template: {
            dir: templatesPath,
            adapter: new HandlebarsAdapter(),
            options: {
              strict: true,
            },
          },
        };
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
