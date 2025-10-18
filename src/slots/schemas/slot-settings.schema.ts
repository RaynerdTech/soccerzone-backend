// src/slots/schemas/slot-settings.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SlotSettingsDocument = SlotSettings & Document;

@Schema({ timestamps: true })
export class SlotSettings {
  @Prop({ default: 7 })
  startHour: number;

  @Prop({ default: 20 })
  endHour: number;

  @Prop({ default: 60 })
  duration: number; // duration in minutes

  @Prop({ default: true })
  isActive: boolean; // optional for enabling/disabling global slots
}

export const SlotSettingsSchema = SchemaFactory.createForClass(SlotSettings);
