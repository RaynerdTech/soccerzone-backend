import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as express from 'express';
import { AppModule } from './app.module';
import { SuperAdminSeeder } from './database/seeds/super-admin.seed';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set global API prefix
  app.setGlobalPrefix('api');

  // Use validation pipes (for DTOs)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Handle raw body for Paystack or Stripe webhooks
  app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

  // Enable CORS for your frontend and ngrok tunnel
app.enableCors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
});


  // Run the SuperAdmin seeder (optional: wrap in try/catch)
  try {
    const seeder = app.get(SuperAdminSeeder);
    await seeder.seed();
    console.log('✅ SuperAdmin seeded successfully');
  } catch (error) {
    console.warn('⚠️ Seeder skipped or failed:', error.message);
  }

  // Start server
  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 Server running on http://localhost:${port}/api`);
  console.log(`✅ Environment check: APP_NAME=${process.env.APP_NAME}`);
  console.log(`✅ SMTP_HOST=${process.env.SMTP_HOST}`);
}

bootstrap();
