// src/slots/schemas/slot.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SlotService } from './slot.service';
import { SlotController } from './slot.controller';
import { Slot, SlotSchema } from '../slots/schemas/slot.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Slot.name, schema: SlotSchema }])],
  controllers: [SlotController],
  providers: [SlotService],
  exports: [SlotService],
})
export class SlotModule {}
