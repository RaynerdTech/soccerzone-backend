import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Slot, SlotDocument } from './schemas/slot.schema';
import { CreateSlotDto } from './dto/create-slot.dto';
import { UpdateSlotDto } from './dto/update-slot.dto';
import { ToggleSlotDto } from './dto/toggle-slot.dto';
import { Role } from '../auth/roles.enum';
import { SlotModule } from '../slots/slot.module';

@Injectable()
export class SlotService {
  private readonly slotsPerDay = [
    '08:00',
    '09:00',
    '10:00',
    '11:00',
    '12:00',
    '13:00',
    '14:00',
    '15:00',
    '16:00',
    '17:00',
    '18:00',
    '19:00',
  ]; // Example times; adjust as needed
  // private defaultSlotAmount = process.env.defaultAmount;

  public defaultSlotAmount = 20000;

  constructor(@InjectModel(Slot.name) private slotModel: Model<SlotDocument>) {}

  /** Utility: calculate endTime (+1 hour) */
  public calculateEndTime(startTime: string): string {
    const [hour, minute] = startTime.split(':').map(Number);
    const endHour = (hour + 1) % 24;
    return `${endHour.toString().padStart(2, '0')}:${minute
      .toString()
      .padStart(2, '0')}`;
  }

  /** ✅ Admin-only: update global booking amount for all slots */
async updateGlobalAmount(amount: number, user: any) {
  if (![Role.ADMIN, Role.SUPER_ADMIN].includes(user.role))
    throw new ForbiddenException('Only admin can update amount');

  // Update all existing slots in DB
  await this.slotModel.updateMany({}, { $set: { amount } });

  // Also update the default in-memory amount for new slots
  this.defaultSlotAmount = amount; // we'll use this in generateDaySlots

  return { message: `All slots updated to amount: ${amount}` };
}

/** ✅ Add a new slot time */
addSlotTime(time: string, user: any) {
  if (![Role.ADMIN, Role.SUPER_ADMIN].includes(user.role))
    throw new ForbiddenException('Only admin can modify slot times');

  if (!/^\d{2}:\d{2}$/.test(time))
    throw new ForbiddenException('Time must be in HH:mm format');

  if (!this.slotsPerDay.includes(time)) {
    this.slotsPerDay.push(time);
    this.slotsPerDay.sort(); // keep it in order
  }

  return { message: `Time ${time} added`, slotsPerDay: this.slotsPerDay };
}

/** ✅ Remove a slot time */
removeSlotTime(time: string, user: any) {
  if (![Role.ADMIN, Role.SUPER_ADMIN].includes(user.role))
    throw new ForbiddenException('Only admin can modify slot times');

  const index = this.slotsPerDay.indexOf(time);
  if (index !== -1) this.slotsPerDay.splice(index, 1); // mutate array instead of reassigning

  return { message: `Time ${time} removed`, slotsPerDay: this.slotsPerDay };
}




  /** Generate full day slots in memory */
  private generateDaySlots(date: string) {
    return this.slotsPerDay.map((time) => ({
      _id: new Types.ObjectId(), // temporary ID
      date,
      startTime: time,
      endTime: this.calculateEndTime(time),
      amount: this.defaultSlotAmount,
      status: 'available',
      isActive: true,
      bookingId: null,
    }));
  }

  /** Merge DB modifications into in-memory slots */
  private mergeDbSlots(memorySlots: any[], dbSlots: SlotDocument[]) {
    const slotMap = new Map(memorySlots.map((s) => [s.startTime, s]));
    for (const dbSlot of dbSlots) {
      if (slotMap.has(dbSlot.startTime)) {
        slotMap.set(dbSlot.startTime, {
          ...slotMap.get(dbSlot.startTime),
          ...dbSlot.toObject(),
        });
      } else {
        // if slot exists in DB but not in template, add it
        slotMap.set(dbSlot.startTime, dbSlot.toObject());
      }
    }
    return Array.from(slotMap.values()).sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    );
  }

  /** ✅ Get all slots for a date */
  async findAll(date?: string) {
    if (!date) return [];

    const memorySlots = this.generateDaySlots(date);
    const dbSlots = await this.slotModel.find({ date }).exec();
    return this.mergeDbSlots(memorySlots, dbSlots);
  }

  /** ✅ Get available slots only */
  async getAvailableSlots(date: string) {
    const allSlots = await this.findAll(date);
    return allSlots.filter((s) => s.status === 'available' && s.isActive);
  }

  /** ✅ Admin-only: create new slot */
  async create(dto: CreateSlotDto, user: any) {
    if (![Role.ADMIN, Role.SUPER_ADMIN].includes(user.role))
      throw new ForbiddenException('Only admin can create slots');

    const existing = await this.slotModel.findOne({
      date: dto.date,
      startTime: dto.startTime,
    });
    if (existing)
      throw new ForbiddenException('Slot already exists for that time');

    const slot = new this.slotModel({
      ...dto,
      endTime: this.calculateEndTime(dto.startTime),
    });

    return slot.save();
  }

  /** ✅ Admin-only: update or auto-create slot if missing */
  async update(
    date: string,
    startTime: string,
    dto: Partial<Omit<UpdateSlotDto, 'date' | 'startTime'>>,
    user: any,
  ) {
    if (![Role.ADMIN, Role.SUPER_ADMIN].includes(user.role))
      throw new ForbiddenException('Only admin can update slots');

    let slot = await this.slotModel.findOne({ date, startTime });

    // If slot doesn’t exist, create it with updates
    if (!slot) {
      const endTime = this.calculateEndTime(startTime);
      slot = new this.slotModel({
        date,
        startTime,
        endTime,
        status: 'available',
        isActive: true,
        bookingId: null,
        ...dto,
      });
      return slot.save();
    }

    if (slot.status === 'booked')
      throw new ForbiddenException('Cannot modify a booked slot');

    Object.assign(slot, dto);
    return slot.save();
  }
  



  /** ✅ Admin-only: toggle slot activity (auto-create if missing) */
async toggleStatus(date: string, startTime: string, dto: ToggleSlotDto, user: any) {
    if (![Role.ADMIN, Role.SUPER_ADMIN].includes(user.role))
      throw new ForbiddenException('Only admin can toggle slot status');

    let slot = await this.slotModel.findOne({ date, startTime });

    if (!slot) {
      const endTime = this.calculateEndTime(startTime);
      slot = new this.slotModel({
        date,
        startTime,
        endTime,
        status: 'available',
        isActive: dto.isActive,
        bookingId: null,
      });
      return slot.save();
    }

    if (slot.status === 'booked')
      throw new ForbiddenException('Cannot toggle a booked slot');

    slot.isActive = dto.isActive;
    return slot.save();
  }

  /** ✅ Admin-only: delete slot */
  async remove(date: string, startTime: string, user: any) {
    if (![Role.ADMIN, Role.SUPER_ADMIN].includes(user.role))
      throw new ForbiddenException('Only admin can delete slots');

    const slot = await this.slotModel.findOne({ date, startTime });
    if (!slot) throw new NotFoundException('Slot not found');

    if (slot.status === 'booked')
      throw new ForbiddenException('Cannot delete a booked slot');

    await this.slotModel.deleteOne({ date, startTime });
    return { message: 'Slot deleted successfully' };
  }

  /** ✅ Booking helpers */
  async markSlotsAsPending(slotIds: string[], bookingId: string) {
    if (!slotIds.length) return;
    await this.slotModel.updateMany(
      { _id: { $in: slotIds.map((id) => new Types.ObjectId(id)) } },
      { $set: { status: 'pending', bookingId } },
    );
  }

  async markSlotsAsBooked(slotIds: string[], bookingId: string) {
    if (!slotIds.length) return;
    await this.slotModel.updateMany(
      { _id: { $in: slotIds.map((id) => new Types.ObjectId(id)) } },
      { $set: { status: 'booked', bookingId } },
    );
  }

  async markSlotsAsAvailable(slotIds: string[]) {
    if (!slotIds.length) return;
    await this.slotModel.updateMany(
      { _id: { $in: slotIds.map((id) => new Types.ObjectId(id)) } },
      { $set: { status: 'available', bookingId: null } },
    );
  }
}
