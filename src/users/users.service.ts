import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { SignupDto } from '../auth/dto/signup.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  // ✅ Create user (used in signup)
  async createUser(dto: SignupDto): Promise<UserDocument> {
    const role = dto.role || 'user';

    const newUser = new this.userModel({
      ...dto,
      role,
    });

    // ✅ Schema pre-save hook will hash password automatically
    return newUser.save();
  }

  // ✅ Find by email, phone, or name (used in signin)
  async findByEmailOrPhone(identifier: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({
        $or: [
          { email: identifier },
          { phone: identifier },
          { name: identifier },
        ],
      })
      .exec();
  }

  // ✅ Find by email (for forgot-password)
  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  // ✅ Find all users (for admin)
  async findAll(): Promise<UserDocument[]> {
    return this.userModel.find().exec();
  }

  // ✅ Find by reset token (for reset password flow)
  async findByResetToken(token: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: new Date() },
      })
      .exec();
  }

  // ✅ Create (admin/superadmin use)
  async create(createUserDto): Promise<UserDocument> {
    // ❌ No need to hash manually here either
    const newUser = new this.userModel({
      ...createUserDto,
    });
    return newUser.save();
  }

  // ✅ Find one
  async findOne(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  // ✅ Update
  async update(id: string, updateUserDto): Promise<UserDocument | null> {
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }
    return this.userModel.findByIdAndUpdate(id, updateUserDto, { new: true }).exec();
  }

  // ✅ Delete
  async remove(id: string): Promise<any> {
    return this.userModel.findByIdAndDelete(id).exec();
  }
}
