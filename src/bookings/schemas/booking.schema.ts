import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BookingDocument = Booking &
  Document & {
    createdAt: Date;
    updatedAt: Date;
  };

@Schema({ timestamps: true })
export class Booking {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: 'Slot', default: [] })
  slotIds: Types.ObjectId[];

  @Prop({ type: [String], default: [] })
  dates: string[];

  @Prop({ type: [String], default: [] })
  startTimes: string[];

  @Prop({ type: [String], default: [] })
  endTimes: string[];

  @Prop({
    default: 'pending',
    enum: ['pending', 'paid', 'booked', 'cancelled', 'failed', 'confirmed'],
  })
  status: 'pending' | 'booked' | 'cancelled' | 'failed' | 'confirmed';

  @Prop({ default: 0 })
  amount: number;

  @Prop({ required: true })
  totalAmount: number;

  @Prop({ type: String, default: null })
  paymentRef: string | null;

  @Prop({ default: false })
  paymentVerified: boolean;

  @Prop({ type: String, default: null })
  ticketId: string | null;

  @Prop({ type: String, unique: true, sparse: true })
  reference?: string;

  @Prop({ default: false })
  emailSent: boolean;

  @Prop({ default: '' })
  teamName?: string;

  @Prop({ type: Date, default: null })
  pendingExpiresAt?: Date | null;

  @Prop({ type: String, required: true })
  bookingId: string;

  @Prop({ type: String, default: null })
  notes?: string;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);
