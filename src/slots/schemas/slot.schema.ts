// src/slots/schemas/slot.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SlotDocument = Slot & Document;

@Schema({ timestamps: true })
export class Slot {
  @Prop({ required: true })
  date: string;

  @Prop({ required: true })
  startTime: string;

  @Prop({ required: true })
  endTime: string;

  @Prop({ default: 20000 })
  amount: number;

  @Prop({ default: 'available', enum: ['available', 'pending', 'booked', 'unavailable'] })
  status: 'available' | 'pending' | 'booked' | 'unavailable';

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: String, ref: 'Booking', default: null })
  bookingId: string | null;

  @Prop({ type: String, ref: 'User', default: null })
  bookedBy: string | null;

  @Prop({ type: Date, default: null })
  pendingExpiresAt?: Date | null; 
}

export const SlotSchema = SchemaFactory.createForClass(Slot);

// ✅ TTL index for pending slots (optional if we want auto-release)
SlotSchema.index(
  { pendingExpiresAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { status: 'pending' } }
);
