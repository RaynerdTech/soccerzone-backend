import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Slot, SlotDocument } from './schemas/slot.schema';
import { CreateSlotDto } from './dto/create-slot.dto';
import { UpdateSlotDto } from './dto/update-slot.dto';
import { ToggleSlotDto } from './dto/toggle-slot.dto';
import { Role } from '../auth/roles.enum';
import { CacheService } from '../cache/cache.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class SlotService {
  private readonly logger = new Logger(SlotService.name);
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
  ];

  public defaultSlotAmount = 20000;

  
  

  constructor(
    @InjectModel(Slot.name) private slotModel: Model<SlotDocument>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly cacheService: CacheService,
  ) {}
  

   async testCache() {
    await this.cacheManager.set('test_slot', { name: 'soccerzone' }, 60);
    const value = await this.cacheManager.get('test_slot');
    console.log('Fetched from Redis:', value);
    return value;
  }

public calculateEndTime(startTime: string): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  const end = new Date();
  end.setHours(hours + 1, minutes, 0, 0); // example 1-hour slot
  return `${end.getHours().toString().padStart(2, '0')}:${end
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
}

  async updateGlobalAmount(amount: number, user: any) {
    if (![Role.ADMIN, Role.SUPER_ADMIN].includes(user.role))
      throw new ForbiddenException('Only admin can update amount');

    await this.slotModel.updateMany({}, { $set: { amount } });
    this.defaultSlotAmount = amount;

    // 🔁 Clear all cached slots since all prices changed
    await this.cacheService.reset();

    return { message: `All slots updated to amount: ${amount}` };
  }

  addSlotTime(time: string, user: any) {
    if (![Role.ADMIN, Role.SUPER_ADMIN].includes(user.role))
      throw new ForbiddenException('Only admin can modify slot times');

    if (!/^\d{2}:\d{2}$/.test(time))
      throw new ForbiddenException('Time must be in HH:mm format');

    if (!this.slotsPerDay.includes(time)) {
      this.slotsPerDay.push(time);
      this.slotsPerDay.sort();
    }

    return { message: `Time ${time} added`, slotsPerDay: this.slotsPerDay };
  }

  removeSlotTime(time: string, user: any) {
    if (![Role.ADMIN, Role.SUPER_ADMIN].includes(user.role))
      throw new ForbiddenException('Only admin can modify slot times');

    const index = this.slotsPerDay.indexOf(time);
    if (index !== -1) this.slotsPerDay.splice(index, 1);

    return { message: `Time ${time} removed`, slotsPerDay: this.slotsPerDay };
  }

  private generateDaySlots(date: string) {
    return this.slotsPerDay.map((time) => ({
      _id: new Types.ObjectId(),
      date,
      startTime: time,
      endTime: this.calculateEndTime(time),
      amount: this.defaultSlotAmount,
      status: 'available',
      isActive: true,
      bookingId: null,
    }));
  }

  private mergeDbSlots(memorySlots: any[], dbSlots: SlotDocument[]) {
    const slotMap = new Map(memorySlots.map((s) => [s.startTime, s]));
    for (const dbSlot of dbSlots) {
      if (slotMap.has(dbSlot.startTime)) {
        slotMap.set(dbSlot.startTime, {
          ...slotMap.get(dbSlot.startTime),
          ...dbSlot.toObject(),
        });
      } else {
        slotMap.set(dbSlot.startTime, dbSlot.toObject());
      }
    }
    return Array.from(slotMap.values()).sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    );
  }

  /** ✅ Fetch all slots for a date (with cache) */
  async findAll(date?: string) {
    if (!date) return [];

    const cacheKey = `slots:${date}`;
    const cached = await this.cacheService.get<Slot[]>(cacheKey);

    if (cached) {
      this.logger.log(`Cache HIT for date ${date}`);
      return cached;
    }

    this.logger.log(`Cache MISS for date ${date}, fetching from DB...`);
    const memorySlots = this.generateDaySlots(date);
    const dbSlots = await this.slotModel.find({ date }).exec();
    const merged = this.mergeDbSlots(memorySlots, dbSlots);

    await this.cacheService.set(cacheKey, merged, 300); // cache 5 min
    return merged;
  }

  async getAvailableSlots(date: string) {
    const allSlots = await this.findAll(date);
    return allSlots.filter((s) => s.status === 'available' && s.isActive);
  }

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

    const saved = await slot.save();
    await this.cacheService.del(`slots:${dto.date}`);
    return saved;
  }

  async update(
    date: string,
    startTime: string,
    dto: Partial<Omit<UpdateSlotDto, 'date' | 'startTime'>>,
    user: any,
  ) {
    if (![Role.ADMIN, Role.SUPER_ADMIN].includes(user.role))
      throw new ForbiddenException('Only admin can update slots');

    let slot = await this.slotModel.findOne({ date, startTime });

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
    } else if (slot.status === 'booked') {
      throw new ForbiddenException('Cannot modify a booked slot');
    } else {
      Object.assign(slot, dto);
    }

    const saved = await slot.save();
    await this.cacheService.del(`slots:${date}`);
    return saved;
  }

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
    } else if (slot.status === 'booked') {
      throw new ForbiddenException('Cannot toggle a booked slot');
    } else {
      slot.isActive = dto.isActive;
    }

    const saved = await slot.save();
    await this.cacheService.del(`slots:${date}`);
    return saved;
  }

  async remove(date: string, startTime: string, user: any) {
    if (![Role.ADMIN, Role.SUPER_ADMIN].includes(user.role))
      throw new ForbiddenException('Only admin can delete slots');

    const slot = await this.slotModel.findOne({ date, startTime });
    if (!slot) throw new NotFoundException('Slot not found');
    if (slot.status === 'booked')
      throw new ForbiddenException('Cannot delete a booked slot');

    await this.slotModel.deleteOne({ date, startTime });
    await this.cacheService.del(`slots:${date}`);

    return { message: 'Slot deleted successfully' };
  }

  async markSlotsAsBooked(slotIds: string[], bookingId: string) {
    if (!slotIds.length) return;
    const slots = await this.slotModel.find({ _id: { $in: slotIds } });
    const dates = [...new Set(slots.map((s) => s.date))];

    await this.slotModel.updateMany(
      { _id: { $in: slotIds.map((id) => new Types.ObjectId(id)) } },
      { $set: { status: 'booked', bookingId } },
    );

    for (const date of dates) await this.cacheService.del(`slots:${date}`);
  }

  async markSlotsAsAvailable(slotIds: string[]) {
    if (!slotIds.length) return;
    const slots = await this.slotModel.find({ _id: { $in: slotIds } });
    const dates = [...new Set(slots.map((s) => s.date))];

    await this.slotModel.updateMany(
      { _id: { $in: slotIds.map((id) => new Types.ObjectId(id)) } },
      { $set: { status: 'available', bookingId: null } },
    );

    for (const date of dates) await this.cacheService.del(`slots:${date}`);
  }
}
