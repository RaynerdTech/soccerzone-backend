// src/database/seeds/super-admin.seed.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { Role } from '../../auth/roles.enum';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SuperAdminSeeder {
  private readonly logger = new Logger(SuperAdminSeeder.name);

  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async seed() {
    const existing = await this.userModel.findOne({ role: Role.SUPER_ADMIN });
    if (existing) {
      this.logger.log('✅ Super Admin already exists');
      return;
    }

    const hashedPassword = await bcrypt.hash('superadmin123', 10);

    await this.userModel.create({
      email: 'superadmin@soccerzone.com',
      password: 'superadmin123',
      name: 'Super Admin',
      role: Role.SUPER_ADMIN,
    });

    this.logger.log('🚀 Super Admin created successfully');
  }
}
