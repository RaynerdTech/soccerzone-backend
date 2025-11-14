import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as express from 'express';
import { AppModule } from './app.module';
import { SuperAdminSeeder } from './database/seeds/super-admin.seed';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // === Global API prefix ===
  app.setGlobalPrefix('api');

  // === Validation pipes ===
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // === Handle raw body for Paystack webhooks ===
  app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

  // === Enable CORS with strict origin checks ===
  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        'https://soccerzone-frontend.vercel.app',
        process.env.FRONTEND_URL, // e.g. https://soccerzone-frontend.vercel.app
        'http://localhost:4000',  // optional local server
        'http://localhost:5173',  // Vite dev server
      ];

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`❌ Blocked by CORS: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // === Run Seeder (optional) ===
  try {
    const seeder = app.get(SuperAdminSeeder);
    await seeder.seed();
    console.log('✅ SuperAdmin seeded successfully');
  } catch (error) {
    console.warn('⚠️ Seeder skipped or failed:', error.message);
  }

  // === Start Server ===
  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 Server running on http://localhost:${port}/api`);
  console.log(`✅ Environment check: APP_NAME=${process.env.APP_NAME}`);
  console.log(`✅ SMTP_HOST=${process.env.SMTP_HOST}`);
  console.log(`✅ FRONTEND_URL=${process.env.FRONTEND_URL}`);
}

bootstrap();
