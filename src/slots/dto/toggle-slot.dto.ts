// src/slots/dto/toggle-slot-status.dto.ts
import { IsBoolean } from 'class-validator';

export class ToggleSlotDto {
  @IsBoolean()
  isActive: boolean;
}

