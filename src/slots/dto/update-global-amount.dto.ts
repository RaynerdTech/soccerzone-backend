// src/slots/dto/update-global-amount.dto.ts
import { IsNumber, Min } from 'class-validator';

export class UpdateGlobalAmountDto {
  @IsNumber()
  @Min(0)
  amount: number;
}