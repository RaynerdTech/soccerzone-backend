import { Injectable, ConflictException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { SignupDto } from '../auth/dto/signup.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  // ✅ Create user (used in signup)
 async createUser(dto: SignupDto): Promise<any> {
    const role = dto.role || 'user';
    const newUser = new this.userModel({ ...dto, role });

    try {
      const savedUser = await newUser.save();
      return {
        success: true,
        statusCode: 201,
        message: 'User created successfully.',
        data: savedUser,
      };
    } catch (error: any) {
      console.error('❌ Error creating user:', error);

      // Always return "User already exists" for duplicate key errors
      if (error.code === 11000) {
        return {
          success: false,
          statusCode: 409,
          message: 'User already exists with this email or phone number.',
          data: null,
        };
      }

      // Everything else
      return {
        success: false,
        statusCode: 500,
        message: 'Internal server error while creating user.',
        data: null,
      };
    }
  }




  // ✅ Find by email, phone, or name (used in signin)
  async findByEmailOrPhone(identifier: string): Promise<UserDocument | null> {
    try {
      return await this.userModel
        .findOne({
          $or: [
            { email: identifier },
            { phone: identifier },
            { name: identifier },
          ],
        })
        .exec();
    } catch (error) {
      console.error('❌ Error finding user by email or phone:', error);
      throw new Error('Internal server error while finding user');
    }
  }

  // ✅ Find by email
  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  // ✅ Find all users (for admin)
  async findAll(): Promise<UserDocument[]> {
    try {
      return await this.userModel.find().exec();
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      throw new Error('Internal server error while fetching users');
    }
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
    try {
      const newUser = new this.userModel(createUserDto);
      return await newUser.save();
    } catch (error) {
      console.error('❌ Error creating user (admin):', error);
      throw new Error('Internal server error while creating user');
    }
  }

  // ✅ Find one
  async findOne(id: string): Promise<UserDocument | null> {
    try {
      return await this.userModel.findById(id).exec();
    } catch (error) {
      console.error('❌ Error finding user:', error);
      throw new Error('Internal server error while finding user');
    }
  }

  // ✅ Update
  async update(id: string, updateUserDto): Promise<UserDocument | null> {
    try {
      if (updateUserDto.password) {
        updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
      }
      return await this.userModel
        .findByIdAndUpdate(id, updateUserDto, { new: true })
        .exec();
    } catch (error) {
      console.error('❌ Error updating user:', error);
      throw new Error('Internal server error while updating user');
    }
  }

  // ✅ Delete
  async remove(id: string): Promise<any> {
    try {
      return await this.userModel.findByIdAndDelete(id).exec();
    } catch (error) {
      console.error('❌ Error deleting user:', error);
      throw new Error('Internal server error while deleting user');
    }
  }
}
