// import { Module } from '@nestjs/common';
// import { ConfigModule } from '@nestjs/config';
// import { MongooseModule } from '@nestjs/mongoose';
// import { AuthModule } from './auth/auth.module';
// import { UsersModule } from './users/users.module';
// import { DatabaseModule } from './database/seeds/database.module';
// import { MailModule } from './mail/mail.module';
// import { SlotModule } from './slots/slot.module';
// import { BookingsModule } from './bookings/bookings.module';

// @Module({
//   imports: [
//     ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
//     MongooseModule.forRoot(process.env.MONGO_URI || ''),
//     AuthModule,
//     UsersModule,
//     DatabaseModule,
//     MailModule,
//     SlotModule,
//     BookingsModule,
//   ],
// })
// export class AppModule {}
//  console.log('✅ PORT from .env:', process.env.PORT);
//   console.log('✅ APP_NAME from .env:', process.env.APP_NAME);
//   console.log('✅ SMTP_HOST from .env:', process.env.SMTP_HOST);


import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DatabaseModule } from './database/seeds/database.module';
import { MailModule } from './mail/mail.module';
import { SlotModule } from './slots/slot.module';
import { BookingsModule } from './bookings/bookings.module';
import { GlobalCacheModule } from './cache/cache.module';
import { TestModule } from './test/test.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    MongooseModule.forRoot(process.env.MONGO_URI || ''),
    GlobalCacheModule, // only this manages Redis now
    AuthModule,
    UsersModule,
    DatabaseModule,
    MailModule,
    SlotModule,
    BookingsModule,
    TestModule,
  ],
})
export class AppModule {
  constructor() {
    console.log('✅ ENV Loaded:');
    console.log('✅ PORT:', process.env.PORT);
    console.log('✅ APP_NAME:', process.env.APP_NAME);
  }
}
