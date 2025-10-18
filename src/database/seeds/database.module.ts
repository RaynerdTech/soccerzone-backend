import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../../users/schemas/user.schema';
import { SuperAdminSeeder } from './super-admin.seed';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  providers: [SuperAdminSeeder],
  exports: [SuperAdminSeeder],
})
export class DatabaseModule {}
