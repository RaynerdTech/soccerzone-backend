// import {
//   Injectable,
//   ForbiddenException,
//   NotFoundException,
//   Logger,
//   Inject,
// } from '@nestjs/common';
// import { InjectModel } from '@nestjs/mongoose';
// import { Model, Types } from 'mongoose';
// import { Slot, SlotDocument } from './schemas/slot.schema';
// import { CreateSlotDto } from './dto/create-slot.dto';
// import { UpdateSlotDto } from './dto/update-slot.dto';
// import { ToggleSlotDto } from './dto/toggle-slot.dto';
// import { Role } from '../auth/roles.enum';
// import { CacheService } from '../cache/cache.service';
// import { CACHE_MANAGER } from '@nestjs/cache-manager';
// import type { Cache } from 'cache-manager';

// @Injectable()
// export class SlotService {
//   private readonly logger = new Logger(SlotService.name);
//   private readonly slotsPerDay = [
//     '08:00',
//     '09:00',
//     '10:00',
//     '11:00',
//     '12:00',
//     '13:00',
//     '14:00',
//     '15:00',
//     '16:00',
//     '17:00',
//     '18:00',
//     '19:00',
//   ];

//   public defaultSlotAmount = 20000;

  
  

//   constructor(
//     @InjectModel(Slot.name) private slotModel: Model<SlotDocument>,
//     @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
//     private readonly cacheService: CacheService,
//   ) {}
  

//    async testCache() {
//     await this.cacheManager.set('test_slot', { name: 'soccerzone' }, 60);
//     const value = await this.cacheManager.get('test_slot');
//     console.log('Fetched from Redis:', value);
//     return value;
//   }

// public calculateEndTime(startTime: string): string {
//   const [hours, minutes] = startTime.split(':').map(Number);
//   const end = new Date();
//   end.setHours(hours + 1, minutes, 0, 0); // example 1-hour slot
//   return `${end.getHours().toString().padStart(2, '0')}:${end
//     .getMinutes()
//     .toString()
//     .padStart(2, '0')}`;
// }

//   async updateGlobalAmount(amount: number, user: any) {
//     if (![Role.ADMIN, Role.SUPER_ADMIN].includes(user.role))
//       throw new ForbiddenException('Only admin can update amount');

//     await this.slotModel.updateMany({}, { $set: { amount } });
//     this.defaultSlotAmount = amount;

//     // Clear all cached slots since all prices changed
//     await this.cacheService.reset();

//     return { message: `All slots updated to amount: ${amount}` };
//   }

//   addSlotTime(time: string, user: any) {
//     if (![Role.ADMIN, Role.SUPER_ADMIN].includes(user.role))
//       throw new ForbiddenException('Only admin can modify slot times');

//     if (!/^\d{2}:\d{2}$/.test(time))
//       throw new ForbiddenException('Time must be in HH:mm format');

//     if (!this.slotsPerDay.includes(time)) {
//       this.slotsPerDay.push(time);
//       this.slotsPerDay.sort();
//     }

//     return { message: `Time ${time} added`, slotsPerDay: this.slotsPerDay };
//   }

//   removeSlotTime(time: string, user: any) {
//     if (![Role.ADMIN, Role.SUPER_ADMIN].includes(user.role))
//       throw new ForbiddenException('Only admin can modify slot times');

//     const index = this.slotsPerDay.indexOf(time);
//     if (index !== -1) this.slotsPerDay.splice(index, 1);

//     return { message: `Time ${time} removed`, slotsPerDay: this.slotsPerDay };
//   }

//   private generateDaySlots(date: string) {
//     return this.slotsPerDay.map((time) => ({
//       _id: new Types.ObjectId(),
//       date,
//       startTime: time,
//       endTime: this.calculateEndTime(time),
//       amount: this.defaultSlotAmount,
//       status: 'available',
//       isActive: true,
//       bookingId: null,
//     }));
//   }

//   private mergeDbSlots(memorySlots: any[], dbSlots: SlotDocument[]) {
//     const slotMap = new Map(memorySlots.map((s) => [s.startTime, s]));
//     for (const dbSlot of dbSlots) {
//       if (slotMap.has(dbSlot.startTime)) {
//         slotMap.set(dbSlot.startTime, {
//           ...slotMap.get(dbSlot.startTime),
//           ...dbSlot.toObject(),
//         });
//       } else {
//         slotMap.set(dbSlot.startTime, dbSlot.toObject());
//       }
//     }
//     return Array.from(slotMap.values()).sort((a, b) =>
//       a.startTime.localeCompare(b.startTime),
//     );
//   }

//   /** ✅ Fetch all slots for a date (with cache) */
//   async findAll(date?: string) {
//     if (!date) return [];

//     const cacheKey = `slots:${date}`;
//     const cached = await this.cacheService.get<Slot[]>(cacheKey);

//     if (cached) {
//       this.logger.log(`Cache HIT for date ${date}`);
//       return cached;
//     }

//     this.logger.log(`Cache MISS for date ${date}, fetching from DB...`);
//     const memorySlots = this.generateDaySlots(date);
//     const dbSlots = await this.slotModel.find({ date }).exec();
//     const merged = this.mergeDbSlots(memorySlots, dbSlots);

//     await this.cacheService.set(cacheKey, merged, 300); // cache 5 min
//     return merged;
//   }

//   async getAvailableSlots(date: string) {
//     const allSlots = await this.findAll(date);
//     return allSlots.filter((s) => s.status === 'available' && s.isActive);
//   }

//   async create(dto: CreateSlotDto, user: any) {
//     if (![Role.ADMIN, Role.SUPER_ADMIN].includes(user.role))
//       throw new ForbiddenException('Only admin can create slots');

//     const existing = await this.slotModel.findOne({
//       date: dto.date,
//       startTime: dto.startTime,
//     });
//     if (existing)
//       throw new ForbiddenException('Slot already exists for that time');

//     const slot = new this.slotModel({
//       ...dto,
//       endTime: this.calculateEndTime(dto.startTime),
//     });

//     const saved = await slot.save();
//     await this.cacheService.del(`slots:${dto.date}`);
//     return saved;
//   }

//   async update(
//     date: string,
//     startTime: string,
//     dto: Partial<Omit<UpdateSlotDto, 'date' | 'startTime'>>,
//     user: any,
//   ) {
//     if (![Role.ADMIN, Role.SUPER_ADMIN].includes(user.role))
//       throw new ForbiddenException('Only admin can update slots');

//     let slot = await this.slotModel.findOne({ date, startTime });

//     if (!slot) {
//       const endTime = this.calculateEndTime(startTime);
//       slot = new this.slotModel({
//         date,
//         startTime,
//         endTime,
//         status: 'available',
//         isActive: true,
//         bookingId: null,
//         ...dto,
//       });
//     } else if (slot.status === 'booked') {
//       throw new ForbiddenException('Cannot modify a booked slot');
//     } else {
//       Object.assign(slot, dto);
//     }

//     const saved = await slot.save();
//     await this.cacheService.del(`slots:${date}`);
//     return saved;
//   }

//   async toggleStatus(date: string, startTime: string, dto: ToggleSlotDto, user: any) {
//     if (![Role.ADMIN, Role.SUPER_ADMIN].includes(user.role))
//       throw new ForbiddenException('Only admin can toggle slot status');

//     let slot = await this.slotModel.findOne({ date, startTime });

//     if (!slot) {
//       const endTime = this.calculateEndTime(startTime);
//       slot = new this.slotModel({
//         date,
//         startTime,
//         endTime,
//         status: 'available',
//         isActive: dto.isActive,
//         bookingId: null,
//       });
//     } else if (slot.status === 'booked') {
//       throw new ForbiddenException('Cannot toggle a booked slot');
//     } else {
//       slot.isActive = dto.isActive;
//     }

//     const saved = await slot.save();
//     await this.cacheService.del(`slots:${date}`);
//     return saved;
//   }

//   async remove(date: string, startTime: string, user: any) {
//     if (![Role.ADMIN, Role.SUPER_ADMIN].includes(user.role))
//       throw new ForbiddenException('Only admin can delete slots');

//     const slot = await this.slotModel.findOne({ date, startTime });
//     if (!slot) throw new NotFoundException('Slot not found');
//     if (slot.status === 'booked')
//       throw new ForbiddenException('Cannot delete a booked slot');

//     await this.slotModel.deleteOne({ date, startTime });
//     await this.cacheService.del(`slots:${date}`);

//     return { message: 'Slot deleted successfully' };
//   }

//   async markSlotsAsBooked(slotIds: string[], bookingId: string) {
//     if (!slotIds.length) return;
//     const slots = await this.slotModel.find({ _id: { $in: slotIds } });
//     const dates = [...new Set(slots.map((s) => s.date))];

//     await this.slotModel.updateMany(
//       { _id: { $in: slotIds.map((id) => new Types.ObjectId(id)) } },
//       { $set: { status: 'booked', bookingId } },
//     );

//     for (const date of dates) await this.cacheService.del(`slots:${date}`);
//   }

//   async markSlotsAsAvailable(slotIds: string[]) {
//     if (!slotIds.length) return;
//     const slots = await this.slotModel.find({ _id: { $in: slotIds } });
//     const dates = [...new Set(slots.map((s) => s.date))];

//     await this.slotModel.updateMany(
//       { _id: { $in: slotIds.map((id) => new Types.ObjectId(id)) } },
//       { $set: { status: 'available', bookingId: null } },
//     );

//     for (const date of dates) await this.cacheService.del(`slots:${date}`);
//   }
// }




// src/slots/slot.service.ts
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Slot, SlotDocument, SlotSettings, SlotSettingsDocument } from './schemas/slot.schema';
import { CreateSlotDto } from './dto/create-slot.dto';
import { UpdateSlotDto } from './dto/update-slot.dto';
import { ToggleSlotDto } from './dto/toggle-slot.dto';
import { Role } from '../auth/roles.enum';
import { CacheService } from '../cache/cache.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class SlotService implements OnModuleInit {
  private readonly logger = new Logger(SlotService.name);

  // Default boot values
  private defaultSlotAmount = 20000;
  private slotsPerDay: string[] = [
    '07:00','08:00','09:00','10:00','11:00','12:00',
    '13:00','14:00','15:00','16:00','17:00','18:00',
    '19:00','20:00'
  ];
  private globalEnabled = true;

  constructor(
    @InjectModel(Slot.name) private readonly slotModel: Model<SlotDocument>,
    @InjectModel(SlotSettings.name) private readonly settingsModel: Model<SlotSettingsDocument>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly cacheService: CacheService,
  ) {}

  async onModuleInit() {
    await this.loadSettings();
  }

  // Load settings from DB or create defaults
  private async loadSettings() {
    let settings = await this.settingsModel.findOne().lean<SlotSettings>();
    if (!settings) {
      settings = (await this.settingsModel.create({})).toObject();
    }

    this.globalEnabled = Boolean(settings.globalEnabled);
    this.defaultSlotAmount = settings.defaultAmount ?? this.defaultSlotAmount;
    this.slotsPerDay =
      Array.isArray(settings.slotsPerDay) && settings.slotsPerDay.length
        ? settings.slotsPerDay
        : this.slotsPerDay;

    await this.cacheService.set('slot:settings', settings, 600);
    this.logger.log('✅ Slot settings loaded and cached');
  }

  public getDefaultSlotAmount(): number {
    return this.defaultSlotAmount;
  }

  async testCache() {
  const testKey = 'slot:test';
  await this.cacheService.set(testKey, { hello: 'world' }, 60);
  const val = await this.cacheService.get(testKey);
  return { message: 'Cache test successful', value: val };
}

  /* ---------- SETTINGS OPERATIONS (ADMIN) ---------- */

  async getSettings() {
    const cached = await this.cacheService.get<SlotSettings>('slot:settings');
    if (cached) return cached;
    const settings = await this.settingsModel.findOne().lean();
    if (settings) {
      await this.cacheService.set('slot:settings', settings, 600);
      return settings;
    }
    return {};
  }

async updateSettings(updates: Partial<SlotSettings>, user: any) {
  if (![Role.ADMIN, Role.SUPER_ADMIN].includes(user.role))
    throw new ForbiddenException('Only admin can update settings');

  let settings = await this.settingsModel.findOne();
  if (!settings) {
    settings = new this.settingsModel();
  }

  // Handle updates
  if (typeof updates.globalEnabled === 'boolean')
    settings.globalEnabled = updates.globalEnabled;
  if (typeof updates.defaultAmount === 'number')
    settings.defaultAmount = updates.defaultAmount;
  if (Array.isArray(updates.slotsPerDay))
    settings.slotsPerDay = updates.slotsPerDay;

  if (Array.isArray((updates as any).addedSlots))
    settings.addedSlots = (updates as any).addedSlots;
  if (Array.isArray((updates as any).removedSlots))
    settings.removedSlots = (updates as any).removedSlots;

  await settings.save();

  // 🔥 Set all slots' isActive = false
  await this.slotModel.updateMany({}, { $set: { isActive: false } });

  // 🔄 Refresh settings and cache
  await this.loadSettings();
  await this.cacheService.reset();

  return { message: 'Settings updated; all slots deactivated', settings };
}


async updateGlobalSettings(updates: Partial<SlotSettings>, user: any) {
  if (![Role.ADMIN, Role.SUPER_ADMIN].includes(user.role))
    throw new ForbiddenException('Only admin can update settings');

  let settings = await this.settingsModel.findOne();
  if (!settings) {
    settings = new this.settingsModel();
  }

  // Update global toggles and values
  if (typeof updates.globalEnabled === 'boolean') {
    settings.globalEnabled = updates.globalEnabled;
    // Apply globally to all slots
    await this.slotModel.updateMany({}, { $set: { isActive: updates.globalEnabled } });
  }

  if (typeof updates.defaultAmount === 'number') {
    settings.defaultAmount = updates.defaultAmount;
    // Apply to all active slots
    await this.slotModel.updateMany({}, { $set: { amount: updates.defaultAmount } });
  }

  if (Array.isArray(updates.slotsPerDay)) {
    settings.slotsPerDay = updates.slotsPerDay;
    // Sync slots based on new times
    await this.syncSlotsWithSettings(updates.slotsPerDay, settings.defaultAmount);
  }

  if (typeof updates.slotToggles === 'object') {
    settings.slotToggles = updates.slotToggles;
    // Apply toggles to respective slots
    for (const [time, isActive] of Object.entries(updates.slotToggles)) {
      await this.slotModel.updateMany({ startTime: time }, { $set: { isActive } });
    }
  }

  if (Array.isArray(updates.addedSlots))
    settings.addedSlots = updates.addedSlots;
  if (Array.isArray(updates.removedSlots))
    settings.removedSlots = updates.removedSlots;

  if (updates.slotAmounts)
    settings.slotAmounts = updates.slotAmounts;
  if (updates.dateOverrides)
    settings.dateOverrides = updates.dateOverrides;

  await settings.save();

  // Refresh settings and cache
  await this.loadSettings();
  await this.cacheService.reset();

  return {
    message: 'Global settings updated successfully and synced with slots',
    settings,
  };
}

async updateSingleSlot(
  date: string,
  time: string,
  updates: {
    isActive?: boolean;
    amount?: number;
    status?: 'available' | 'booked' | 'unavailable';
  },
  user: any,
) {
  if (![Role.ADMIN, Role.SUPER_ADMIN].includes(user.role))
    throw new ForbiddenException('Only admin can modify slots');

  let slot = await this.slotModel.findOne({ date, startTime: time });

  if (!slot) {
    slot = new this.slotModel({
      date,
      startTime: time,
      endTime: this.calculateEndTime(time),
      isActive: updates.isActive ?? true,
      amount: updates.amount ?? 20000,
      status: updates.status ?? 'available',
    });
  } else {
    if (typeof updates.isActive === 'boolean') slot.isActive = updates.isActive;
    if (typeof updates.amount === 'number') slot.amount = updates.amount;
    if (updates.status && ['available', 'booked', 'unavailable'].includes(updates.status)) {
      slot.status = updates.status as 'available' | 'booked' | 'unavailable';
    }
  }

  await slot.save();
  await this.cacheService.reset();

  return {
    message: `Slot for ${date} at ${time} updated successfully`,
    slot,
  };
}




private async syncSlotsWithSettings(slotsPerDay: string[], defaultAmount: number) {
  const allDates = await this.slotModel.distinct('date');
  for (const date of allDates) {
    const existingSlots = await this.slotModel.find({ date });
    const existingTimes = existingSlots.map(s => s.startTime);

    // Add missing slots
    for (const time of slotsPerDay) {
      if (!existingTimes.includes(time)) {
        await this.slotModel.create({
          date,
          startTime: time,
          endTime: this.calculateEndTime(time),
          amount: defaultAmount,
          status: 'available',
          isActive: true,
        });
      }
    }

    // Remove slots no longer in schedule
    for (const time of existingTimes) {
      if (!slotsPerDay.includes(time)) {
        await this.slotModel.deleteMany({ date, startTime: time });
      }
    }
  }
}

// private calculateEndTime(startTime: string): string {
//   const [hour, minute] = startTime.split(':').map(Number);
//   const endHour = hour + 1;
//   return `${String(endHour).padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
// }




  async toggleSlotTime(time: string, value: boolean, user: any) {
    if (![Role.ADMIN, Role.SUPER_ADMIN].includes(user.role))
      throw new ForbiddenException('Only admin');

    const settings = (await this.settingsModel.findOne()) ?? new this.settingsModel();
    settings.slotToggles = { ...(settings.slotToggles || {}), [time]: value };

    await settings.save();
    await this.loadSettings();
    await this.cacheService.reset();

    return { message: `Slot ${time} toggled to ${value}` };
  }

  async updateAmount(scope: 'global' | 'time' | 'date', key: string | null, amount: number, user: any) {
    if (![Role.ADMIN, Role.SUPER_ADMIN].includes(user.role))
      throw new ForbiddenException('Only admin');

    const settings = (await this.settingsModel.findOne()) ?? new this.settingsModel();

    if (scope === 'global') {
      settings.defaultAmount = amount;
    } else if (scope === 'time' && key) {
      settings.slotAmounts = { ...(settings.slotAmounts || {}), [key]: amount };
    } else if (scope === 'date' && key) {
      const existing = (settings.dateOverrides || {})[key] || {};
      settings.dateOverrides = {
        ...(settings.dateOverrides || {}),
        [key]: { ...existing, amount },
      };
    }

    await settings.save();
    await this.loadSettings();
    await this.cacheService.reset();

    return { message: 'Amount updated', scope, key, amount };
  }

  async addSlotTimeToMaster(time: string, user: any) {
    if (![Role.ADMIN, Role.SUPER_ADMIN].includes(user.role))
      throw new ForbiddenException('Only admin');

    const settings = (await this.settingsModel.findOne()) ?? new this.settingsModel();
    const list = new Set(settings.slotsPerDay || []);
    list.add(time);
    settings.slotsPerDay = Array.from(list).sort();

    await settings.save();
    await this.loadSettings();
    await this.cacheService.reset();

    return { message: `Added slot ${time}`, slotsPerDay: settings.slotsPerDay };
  }

  async removeSlotTimeFromMaster(time: string, user: any) {
    if (![Role.ADMIN, Role.SUPER_ADMIN].includes(user.role))
      throw new ForbiddenException('Only admin');

    const settings = (await this.settingsModel.findOne()) ?? new this.settingsModel();
    settings.slotsPerDay = (settings.slotsPerDay || []).filter((t) => t !== time);

    await settings.save();
    await this.loadSettings();
    await this.cacheService.reset();

    return { message: `Removed slot ${time}`, slotsPerDay: settings.slotsPerDay };
  }

  /* ---------- SLOT CRUD + LOGIC ---------- */

  public calculateEndTime(startTime: string): string {
    const [hours, minutes] = startTime.split(':').map(Number);
    const end = new Date();
    end.setHours(hours + 1, minutes, 0, 0);
    return `${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`;
  }

  private assembleMemorySlotsForDate(date: string, settings: any) {
    const slots = settings.slotsPerDay || this.slotsPerDay;
    const defaultAmount = settings.defaultAmount ?? this.defaultSlotAmount;

    return slots.map((time: string) => {
      const perTimeAmount = settings.slotAmounts?.[time];
      const dateOverride = settings.dateOverrides?.[date];
      const perTimeToggle = settings.slotToggles?.[time];
      const isActive = (dateOverride?.isActive ?? perTimeToggle ?? true) && !!settings.globalEnabled;

      const amount = dateOverride?.amount ?? perTimeAmount ?? defaultAmount;

      return {
        _id: new Types.ObjectId(),
        date,
        startTime: time,
        endTime: this.calculateEndTime(time),
        amount,
        status: 'available',
        isActive,
        bookingId: null,
      };
    });
  }

  private mergeDbSlots(memorySlots: any[], dbSlots: SlotDocument[]) {
    const slotMap = new Map(memorySlots.map((s) => [s.startTime, s]));
    for (const dbSlot of dbSlots) {
      slotMap.set(dbSlot.startTime, { ...slotMap.get(dbSlot.startTime), ...dbSlot.toObject() });
    }
    return Array.from(slotMap.values()).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  async findAll(date?: string) {
    if (!date) return [];

    const cacheKey = `slots:${date}`;
    const cached = await this.cacheService.get<any[]>(cacheKey);
    if (cached) return cached;

   const settings: any = (await this.getSettings()) || {};
   if (!settings?.globalEnabled) {
  this.logger.warn('Global slots disabled');
  return [];
}


    const memorySlots = this.assembleMemorySlotsForDate(date, settings);
    const dbSlots = await this.slotModel.find({ date }).exec();
    const merged = this.mergeDbSlots(memorySlots, dbSlots);

    await this.cacheService.set(cacheKey, merged, 300);
    return merged;
  }

  async getAvailableSlots(date: string) {
    const all = await this.findAll(date);
    return all.filter((s) => s.status === 'available' && s.isActive);
  }

  //  async getAvailableSlotsWithInfo(date: string) {
  //   const all = await this.findAll(date);
  //   return all.filter((s) => s.status === 'available' && s.isActive);
  // }

  async create(dto: CreateSlotDto, user: any) {
    if (![Role.ADMIN, Role.SUPER_ADMIN].includes(user.role))
      throw new ForbiddenException('Only admin');

    const existing = await this.slotModel.findOne({ date: dto.date, startTime: dto.startTime });
    if (existing) throw new ForbiddenException('Slot already exists');

    const saved = await new this.slotModel({
      ...dto,
      endTime: this.calculateEndTime(dto.startTime),
    }).save();

    await this.cacheService.del(`slots:${dto.date}`);
    return saved;
  }

  async update(date: string, startTime: string, dto: Partial<UpdateSlotDto>, user: any) {
    if (![Role.ADMIN, Role.SUPER_ADMIN].includes(user.role))
      throw new ForbiddenException('Only admin');

    let slot = await this.slotModel.findOne({ date, startTime });
    if (!slot) {
      slot = new this.slotModel({
        date,
        startTime,
        endTime: this.calculateEndTime(startTime),
        ...dto,
      });
    } else if (slot.status === 'booked') {
      throw new ForbiddenException('Cannot modify booked slot');
    } else {
      Object.assign(slot, dto);
    }

    const saved = await slot.save();
    await this.cacheService.del(`slots:${date}`);
    return saved;
  }

  async toggleStatus(date: string, startTime: string, dto: ToggleSlotDto, user: any) {
    if (![Role.ADMIN, Role.SUPER_ADMIN].includes(user.role))
      throw new ForbiddenException('Only admin');

    let slot = await this.slotModel.findOne({ date, startTime });
    if (!slot) {
      slot = new this.slotModel({
        date,
        startTime,
        endTime: this.calculateEndTime(startTime),
        isActive: dto.isActive,
        status: 'available',
      });
    } else if (slot.status === 'booked') {
      throw new ForbiddenException('Cannot toggle booked slot');
    } else {
      slot.isActive = dto.isActive;
    }

    const saved = await slot.save();
    await this.cacheService.del(`slots:${date}`);
    return saved;
  }

  async remove(date: string, startTime: string, user: any) {
    if (![Role.ADMIN, Role.SUPER_ADMIN].includes(user.role))
      throw new ForbiddenException('Only admin');

    const slot = await this.slotModel.findOne({ date, startTime });
    if (!slot) throw new NotFoundException('Slot not found');
    if (slot.status === 'booked') throw new ForbiddenException('Cannot delete booked slot');

    await this.slotModel.deleteOne({ date, startTime });
    await this.cacheService.del(`slots:${date}`);
    return { message: 'Slot deleted' };
  }

  async markSlotsAsBooked(slotIds: string[], bookingId: string) {
    if (!slotIds.length) return;
    const slots = await this.slotModel.find({ _id: { $in: slotIds.map((id) => new Types.ObjectId(id)) } });
    const dates = [...new Set(slots.map((s) => s.date))];
    await this.slotModel.updateMany({ _id: { $in: slotIds.map((id) => new Types.ObjectId(id)) } }, { $set: { status: 'booked', bookingId } });
    for (const date of dates) await this.cacheService.del(`slots:${date}`);
  }

  async markSlotsAsAvailable(slotIds: string[]) {
    if (!slotIds.length) return;
    const slots = await this.slotModel.find({ _id: { $in: slotIds.map((id) => new Types.ObjectId(id)) } });
    const dates = [...new Set(slots.map((s) => s.date))];
    await this.slotModel.updateMany({ _id: { $in: slotIds.map((id) => new Types.ObjectId(id)) } }, { $set: { status: 'available', bookingId: null } });
    for (const date of dates) await this.cacheService.del(`slots:${date}`);
  }
}
