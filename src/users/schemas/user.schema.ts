import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Document } from 'mongoose';
import { Role } from '../../auth/roles.enum';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ unique: false, sparse: true, required: false })
  phone?: string;

  @Prop({ required: true })
  password: string;

  @Prop({ default: Role.USER, enum: Role })
  role: Role;

  @Prop()
  name: string;

  @Prop()
  avatar?: string; // ✅ OPTIONAL AVATAR ADDED HERE

  @Prop()
  resetPasswordToken?: string;

  @Prop()
  resetPasswordExpires?: Date;

  async comparePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }
}

export const UserSchema = SchemaFactory.createForClass(User);
