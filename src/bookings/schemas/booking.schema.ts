import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BookingDocument = Booking & Document;

@Schema({ timestamps: true })
export class Booking {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId; // the user making the booking

  @Prop({ type: [Types.ObjectId], ref: 'Slot', default: [] })
  slotIds: Types.ObjectId[]; // store references to slots (more robust than strings)

  @Prop({ type: [String], default: [] })
  dates: string[]; // store dates of each slot

  @Prop({ type: [String], default: [] })
  startTimes: string[]; // store startTimes of each slot

  @Prop({ type: [String], default: [] })
  endTimes: string[]; // store endTimes of each slot (optional but useful)

  @Prop({ default: 'pending', enum: ['pending', 'booked', 'cancelled', 'failed', 'confirmed'] })
  status: 'pending' | 'booked' | 'cancelled' | 'failed' | 'confirmed';

  @Prop({ default: 0 })
  amount: number; // can store amount per slot if needed

  @Prop({ required: true })
  totalAmount: number; // total amount for the booking

  @Prop({ type: String, default: null })
  paymentRef: string | null;

  @Prop({ type: String, default: null })
  ticketId: string | null;

  @Prop({ default: false })
  emailSent: boolean;

  @Prop({ default: '' })
  teamName?: string;

  @Prop({ type: Date, default: null })
  pendingExpiresAt?: Date | null;

  @Prop({ type: String, required: true })
  bookingId: string; // unique ID for the booking

  @Prop({ type: String, default: null })
  notes?: string; // optional notes for admin/user
}

export const BookingSchema = SchemaFactory.createForClass(Booking);
