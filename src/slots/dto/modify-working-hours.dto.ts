// src/slots/dto/modify-working-hours.dto.ts
import { IsInt, Min, Max } from 'class-validator';

export class ModifyWorkingHoursDto {
  @IsInt()
  @Min(0)
  @Max(23)
  startHour: number;

  @IsInt()
  @Min(1)
  @Max(24)
  endHour: number;
}
