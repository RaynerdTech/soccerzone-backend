import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

  // === Enable CORS ===
  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        'https://soccerzone-frontend.vercel.app',
        process.env.FRONTEND_URL,
        'http://localhost:4000',
        'http://localhost:5173',
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

  // === Swagger Documentation ===
  const config = new DocumentBuilder()
    .setTitle('Soccerzone API')
    .setDescription('API documentation for Soccerzone backend services')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // auto-generate swagger JSON file into /swagger.json
  const fs = require('fs');
  fs.writeFileSync('./swagger.json', JSON.stringify(document, null, 2));

  // serve swagger at /api/docs
  SwaggerModule.setup('/api/docs', app, document);

  console.log('📘 Swagger running at http://localhost:${port}/api/docs');
  console.log('📘 Swagger JSON generated at /swagger.json');

  // === Seeder ===
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
  console.log(`ENV → APP_NAME=${process.env.APP_NAME}`);
  console.log(`ENV → SMTP_HOST=${process.env.SMTP_HOST}`);
  console.log(`ENV → FRONTEND_URL=${process.env.FRONTEND_URL}`);
}

bootstrap();
