// src/mail/mail.module.ts
import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';
import { existsSync } from 'fs';

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
          ? join(process.cwd(), 'dist', 'src', 'mail', 'templates')
          : join(process.cwd(), 'src', 'mail', 'templates');

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
