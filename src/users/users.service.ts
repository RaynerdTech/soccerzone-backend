import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { SignupDto } from '../auth/dto/signup.dto';
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';
import { EditProfileDto } from './dto/edit-profile.dto';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
  ) {}

  // Create user (signup)
  async createUser(dto: SignupDto): Promise<User> {
    // Check for existing user
    const existing = await this.userModel.findOne({
      $or: [{ email: dto.email }, { phone: dto.phone }],
    });
    if (existing) throw new BadRequestException('User already exists');

    // ✅ Hash the password before saving
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = new this.userModel({
      ...dto,
      password: hashedPassword,
    });

    return user.save();
  }

  async findByPhone(phone: string): Promise<UserDocument | null> {
    try {
      return await this.userModel.findOne({ phone }).exec();
    } catch (error) {
      console.error('Error finding user by phone:', error);
      throw new InternalServerErrorException('Error finding user by phone.');
    }
  }

  // Find user by email, phone, or name
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
      console.error('Error finding user by email or phone:', error);
      throw new InternalServerErrorException('Error finding user.');
    }
  }

  // Find user by email
  async findByEmail(email: string): Promise<UserDocument | null> {
    try {
      return await this.userModel.findOne({ email }).exec();
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw new InternalServerErrorException('Error finding user.');
    }
  }
  // async findByEmail(email: string): Promise<UserDocument | null> {
  //   return this.userModel.findOne({ email }).exec();
  // }

  // Get all users
  async findAll(): Promise<any[]> {
    try {
      // Fetch all users
      const users = await this.userModel.find().lean();

      // Fetch all bookings once
      const allBookings = await this.bookingModel.find().lean();

      // Combine user data with computed stats
      const results = users.map((user) => {
        const bookings = allBookings.filter(
          (b) => String(b.user) === String(user._id),
        );

        const totalBookings = bookings.length;
        const totalAmount = bookings.reduce(
          (sum, b) => sum + (b.totalAmount || 0),
          0,
        );

        const latestBooking =
          bookings.sort(
            (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
          )[0] || null;

        const firstBooking =
          bookings.sort(
            (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt),
          )[0] || null;

        return {
          ...user, // keep all original user fields
          totalBookings,
          totalAmount,
          firstBookingDate: firstBooking?.createdAt ?? null,
          lastBookingDate: latestBooking?.createdAt ?? null,
        };
      });

      return results;
    } catch (error) {
      console.error('Error fetching users with summaries:', error);
      throw new InternalServerErrorException('Error fetching users.');
    }
  }

  // Edit Profile (User Self-Update)
  async editProfile(userId: string, dto: any) {
    try {
      const allowedFields = ['name', 'email', 'phone', 'avatar'];

      const updateData = {};

      for (const key of allowedFields) {
        if (dto[key]) updateData[key] = dto[key];
      }

      if (dto.password) {
        updateData['password'] = await bcrypt.hash(dto.password, 10);
      }

      if (dto.role) {
        throw new BadRequestException('You cannot change your role.');
      }

      const updated = await this.userModel.findByIdAndUpdate(
        userId,
        updateData,
        {
          new: true,
        },
      );

      if (!updated) throw new NotFoundException('User not found');

      return updated;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw new InternalServerErrorException('Error updating profile.');
    }
  }

  async editOwnProfile(userId: string, dto: EditProfileDto) {
    const allowedFields = ['name', 'phone', 'avatar'];
    const updateData: any = {};

    for (const key of allowedFields) {
      if (dto[key] !== undefined && dto[key] !== null && dto[key] !== '') {
        updateData[key] = dto[key];
      }
    }

    if (dto.password) {
      updateData.password = await bcrypt.hash(dto.password, 10);
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(userId, updateData, { new: true })
      .select('-password'); // 🟢 avoids TS delete error

    if (!updatedUser) throw new NotFoundException('User not found');

    return updatedUser;
  }

  // user.service.ts or slot.service.ts

  async getAllUsersWithBookingStats() {
    const users = await this.userModel.aggregate([
      {
        $lookup: {
          from: 'bookings',
          localField: '_id',
          foreignField: 'userId',
          as: 'bookings',
        },
      },
      {
        $addFields: {
          totalBookings: { $size: '$bookings' },
          lastBooking: { $max: '$bookings.createdAt' },
        },
      },
      {
        $project: {
          password: 0, // never expose password
          bookings: 0, // remove the joined array to keep output clean
        },
      },
    ]);

    return users;
  }

  // Find user by reset token
  async findByResetToken(token: string): Promise<UserDocument | null> {
    try {
      return await this.userModel
        .findOne({
          resetPasswordToken: token,
          resetPasswordExpires: { $gt: new Date() },
        })
        .exec();
    } catch (error) {
      console.error('Error finding user by reset token:', error);
      throw new InternalServerErrorException('Error finding user.');
    }
  }

  // Create user (admin)
  async create(createUserDto): Promise<UserDocument> {
    try {
      const newUser = new this.userModel(createUserDto);
      return await newUser.save();
    } catch (error) {
      console.error('Error creating user (admin):', error);
      throw new InternalServerErrorException('Error creating user.');
    }
  }

  // Find one user by ID
  // async findOne(id: string): Promise<UserDocument | null> {
  //   try {
  //     return await this.userModel.findById(id).exec();
  //   } catch (error) {
  //     console.error('Error finding user by ID:', error);
  //     throw new InternalServerErrorException('Error finding user.');
  //   }
  // }

  // Find one user by ID (with booking summary)
  async findOne(id: string): Promise<any> {
    try {
      const user = await this.userModel.findById(id).lean();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Fetch all bookings for this user
      const bookings = await this.bookingModel.find({ user: id }).lean();

      // Compute summary stats
      const totalBookings = bookings.length;
      const totalAmount = bookings.reduce(
        (sum, b) => sum + (b.totalAmount || 0),
        0,
      );
      const confirmedBookings = bookings.filter(
        (b) => b.status === 'confirmed',
      ).length;
      const pendingBookings = bookings.filter(
        (b) => b.status === 'pending',
      ).length;

      // Latest and earliest bookings
      const latestBooking =
        bookings.sort(
          (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
        )[0] || null;
      const firstBooking =
        bookings.sort(
          (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt),
        )[0] || null;

      // Build response
      return {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          createdAt: (user as any).createdAt,
        },
        summary: {
          totalBookings,
          confirmedBookings,
          pendingBookings,
          totalAmount,
          firstBookingDate: firstBooking?.createdAt ?? null,
          lastBookingDate: latestBooking?.createdAt ?? null,
        },
        bookings: bookings.map((b) => ({
          id: b._id,
          bookingId: b.bookingId,
          status: b.status,
          totalAmount: b.totalAmount,
          slotCount: b.slotIds?.length || 0,
          dates: b.dates || [],
          startTimes: b.startTimes || [],
          endTimes: b.endTimes || [],
          paymentVerified: b.paymentVerified,
          paymentRef: b.paymentRef,
          ticketId: b.ticketId,
          createdAt: b.createdAt,
        })),
      };
    } catch (error) {
      console.error('Error finding user by ID with bookings:', error);
      throw new InternalServerErrorException(
        'Error fetching user with bookings.',
      );
    }
  }

  // Update user
  async update(id: string, updateUserDto): Promise<UserDocument | null> {
    try {
      if (updateUserDto.password) {
        updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
      }
      return await this.userModel
        .findByIdAndUpdate(id, updateUserDto, { new: true })
        .exec();
    } catch (error) {
      console.error('Error updating user:', error);
      throw new InternalServerErrorException('Error updating user.');
    }
  }

  // Delete user
  async remove(id: string): Promise<any> {
    try {
      return await this.userModel.findByIdAndDelete(id).exec();
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new InternalServerErrorException('Error deleting user.');
    }
  }

  // Admin stats with revenue breakdown
  async getAdminStats() {
    try {
      const totalUsers: number = await this.userModel.countDocuments().exec();
      const totalBookings: number = await this.bookingModel
        .countDocuments()
        .exec();

      // Revenue grouped by booking status
      const revenueByStatus: { _id: string; totalRevenue: number }[] =
        await this.bookingModel.aggregate([
          {
            $group: {
              _id: '$status',
              totalRevenue: { $sum: { $ifNull: ['$totalAmount', 0] } },
            },
          },
        ]);

      const revenueSummary: Record<string, number> = revenueByStatus.reduce(
        (acc: Record<string, number>, item) => {
          acc[item._id] = item.totalRevenue ?? 0;
          return acc;
        },
        {},
      );

      const totalRevenue: number = Object.values(revenueSummary).reduce(
        (sum: number, value: number) => sum + value,
        0,
      );

      return {
        totalUsers,
        totalBookings,
        totalRevenue,
        revenueByStatus: revenueSummary,
      };
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      throw new InternalServerErrorException('Error fetching stats.');
    }
  }

  async updateUser(id: string, updateData: any) {
    return this.update(id, updateData);
  }

  async findById(id: string) {
    return this.userModel.findById(id).exec();
  }

  async createAdminGuestUser(data: {
    name?: string;
    email?: string;
    adminId: string;
  }): Promise<UserDocument> {
    return await this.userModel.create({
      name: data.name || 'Guest User',
      email: data.email || `admin-guest-${Date.now()}@system.com`,
      password: null,
      role: 'GUEST',
      createdByAdmin: data.adminId,
    });
  }
}
