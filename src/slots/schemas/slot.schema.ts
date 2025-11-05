// 

// src/slots/schemas/slot.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SlotDocument = Slot & Document;

@Schema({ timestamps: true })
export class Slot {
  @Prop({ required: true }) date: string;
  @Prop({ required: true }) startTime: string;
  @Prop({ required: true }) endTime: string;
  @Prop({ default: 20000 }) amount: number;
  @Prop({ default: 'available', enum: ['available', 'booked', 'unavailable'] })
  status: 'available' | 'booked' | 'unavailable';
  @Prop({ default: true }) isActive: boolean;
  @Prop({ type: String, ref: 'Booking', default: null }) bookingId: string | null;
  @Prop({ type: String, ref: 'User', default: null }) bookedBy: string | null;
  @Prop({ type: Date, default: null }) pendingExpiresAt?: Date | null;
}

export const SlotSchema = SchemaFactory.createForClass(Slot);
// TTL index for pending slots (optional)
SlotSchema.index(
  { pendingExpiresAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { status: 'pending' } },
);


export type SlotSettingsDocument = SlotSettings & Document;

@Schema({ timestamps: true })
export class SlotSettings {
  // global enable/disable
  @Prop({ default: true }) globalEnabled: boolean;

  // default amount
  @Prop({ default: 20000 }) defaultAmount: number;

  // master list of times to generate for each day
  @Prop({ type: [String], default: [
    '07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00', '19:00','20:00'
  ]})
  slotsPerDay: string[];

  // per-time toggles (map time->boolean)
  @Prop({ type: Object, default: {} })
  slotToggles: Map<string, boolean>;

  // per-time amount overrides (map time->number)
  @Prop({ type: Map, of: Number, default: {} })
  slotAmounts: Map<string, number>;

  // date-specific overrides (map date-> object { amount?, isActive? })
  @Prop({ type: Map, of: Object, default: {} })
  dateOverrides: Map<string, { amount?: number; isActive?: boolean }>;

  // for convenience: store added/removed times (optional)
  @Prop({ type: [String], default: [] })
  addedSlots: string[];

  @Prop({ type: [String], default: [] })
  removedSlots: string[];
}

export const SlotSettingsSchema = SchemaFactory.createForClass(SlotSettings);
