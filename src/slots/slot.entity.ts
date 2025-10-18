// src/slots/slot.entity.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Slot extends Document {
  @Prop({ required: true })
  date: string; // e.g. "2025-10-10"

  @Prop({ required: true })
  startTime: string; // e.g. "07:00"

  @Prop({ required: true })
  endTime: string; // e.g. "08:00"

  @Prop({ default: 'available', enum: ['available', 'booked'] })
  status: string;
}

export const SlotSchema = SchemaFactory.createForClass(Slot);
export type SlotDocument = Slot & Document;
