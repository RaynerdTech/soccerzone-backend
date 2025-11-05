import { Injectable, InternalServerErrorException, NotFoundException, } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';
import { SignupDto } from '../auth/dto/signup.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
  ) {}

  // Create user (signup)
  async createUser(dto: SignupDto): Promise<any> {
    const role = dto.role || 'user';
    const newUser = new this.userModel({ ...dto, role });

    try {
      const savedUser = await newUser.save();
      return { success: true, statusCode: 201, message: 'User created.', data: savedUser };
    } catch (error: any) {
      console.error('Error creating user:', error);
      if (error.code === 11000) {
        return { success: false, statusCode: 409, message: 'User already exists.', data: null };
      }
      return { success: false, statusCode: 500, message: 'Server error.', data: null };
    }
  }

  // Find user by email, phone, or name
  async findByEmailOrPhone(identifier: string): Promise<UserDocument | null> {
    try {
      return await this.userModel.findOne({
        $or: [{ email: identifier }, { phone: identifier }, { name: identifier }],
      }).exec();
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
        (b) => String(b.user) === String(user._id)
      );

      const totalBookings = bookings.length;
      const totalAmount = bookings.reduce(
        (sum, b) => sum + (b.totalAmount || 0),
        0
      );

      const latestBooking =
        bookings.sort(
          (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)
        )[0] || null;

      const firstBooking =
        bookings.sort(
          (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)
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
    console.error("Error fetching users with summaries:", error);
    throw new InternalServerErrorException("Error fetching users.");
  }
}


  // user.service.ts or slot.service.ts

async getAllUsersWithBookingStats() {
  const users = await this.userModel.aggregate([
    {
      $lookup: {
        from: 'bookings',
        localField: '_id',
        foreignField: 'userId',
        as: 'bookings'
      }
    },
    {
      $addFields: {
        totalBookings: { $size: '$bookings' },
        lastBooking: { $max: '$bookings.createdAt' }
      }
    },
    {
      $project: {
        password: 0, // never expose password
        bookings: 0, // remove the joined array to keep output clean
      }
    }
  ]);

  return users;
}


  // Find user by reset token
  async findByResetToken(token: string): Promise<UserDocument | null> {
    try {
      return await this.userModel.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: new Date() },
      }).exec();
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
    const bookings = await this.bookingModel
      .find({ user: id })
      .lean();

    // Compute summary stats
    const totalBookings = bookings.length;
    const totalAmount = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
    const pendingBookings = bookings.filter(b => b.status === 'pending').length;

    // Latest and earliest bookings
    const latestBooking = bookings.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0] || null;
    const firstBooking = bookings.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))[0] || null;

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
      bookings: bookings.map(b => ({
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
    throw new InternalServerErrorException('Error fetching user with bookings.');
  }
}


  // Update user
  async update(id: string, updateUserDto): Promise<UserDocument | null> {
    try {
      if (updateUserDto.password) {
        updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
      }
      return await this.userModel.findByIdAndUpdate(id, updateUserDto, { new: true }).exec();
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
      const totalBookings: number = await this.bookingModel.countDocuments().exec();

      // Revenue grouped by booking status
      const revenueByStatus: { _id: string; totalRevenue: number }[] =
        await this.bookingModel.aggregate([
          { $group: { _id: '$status', totalRevenue: { $sum: { $ifNull: ['$totalAmount', 0] } } } },
        ]);

      const revenueSummary: Record<string, number> = revenueByStatus.reduce(
        (acc: Record<string, number>, item) => {
          acc[item._id] = item.totalRevenue ?? 0;
          return acc;
        },
        {}
      );

      const totalRevenue: number = Object.values(revenueSummary).reduce(
        (sum: number, value: number) => sum + value,
        0
      );

      return { totalUsers, totalBookings, totalRevenue, revenueByStatus: revenueSummary };
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      throw new InternalServerErrorException('Error fetching stats.');
    }
  }
}
