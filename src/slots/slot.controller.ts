// src/slots/schemas/slot.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { SlotService } from './slot.service';
import { CreateSlotDto } from './dto/create-slot.dto';
import { UpdateSlotDto } from './dto/update-slot.dto';
import { ToggleSlotDto } from './dto/toggle-slot.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/roles.enum';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: Role;
  };
}

@Controller('slots')
export class SlotController {
  constructor(private readonly slotService: SlotService) {}

  // ✅ Public: view all slots for a date
  @Get()
  async findAll(@Query('date') date?: string) {
    return this.slotService.findAll(date);
  }

  // ✅ Admin: create a slot
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post()
  create(@Body() dto: CreateSlotDto, @Req() req: AuthenticatedRequest) {
    if (!req.user) throw new ForbiddenException('Unauthorized');
    return this.slotService.create(dto, req.user);
  }

  // ✅ Admin: update a slot by date + startTime
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
 @Patch()
  update(
  @Query('date') date: string,
  @Query('startTime') startTime: string,
  @Body() dto: Partial<Omit<UpdateSlotDto, 'date' | 'startTime'>>,
  @Req() req: AuthenticatedRequest,
) {
  if (!req.user) throw new ForbiddenException('Unauthorized');
  return this.slotService.update(date, startTime, dto, req.user);
}

  // ✅ Admin: toggle slot active/inactive
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Patch('toggle')
  toggle(
    @Query('date') date: string,
    @Query('startTime') startTime: string,
    @Body() dto: ToggleSlotDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.user) throw new ForbiddenException('Unauthorized');
    return this.slotService.toggleStatus(date, startTime, dto, req.user);
  }

  // ✅ Admin: delete a slot
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Delete()
  remove(
    @Query('date') date: string,
    @Query('startTime') startTime: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.user) throw new ForbiddenException('Unauthorized');
    return this.slotService.remove(date, startTime, req.user);
  }

  /** 🔒 Admin: update global amount */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Patch('update-global-amount')
  updateGlobalAmount(
    @Body('amount') amount: number,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.user) throw new ForbiddenException('Unauthorized');
    return this.slotService.updateGlobalAmount(amount, req.user);
  }

  /** 🔒 Admin: add slot time to daily schedule */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Patch('add-slot-time')
  addSlotTime(
    @Body('time') time: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.user) throw new ForbiddenException('Unauthorized');
    return this.slotService.addSlotTime(time, req.user);
  }

  /** 🔒 Admin: remove slot time from daily schedule */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Patch('remove-slot-time')
  removeSlotTime(
    @Body('time') time: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.user) throw new ForbiddenException('Unauthorized');
    return this.slotService.removeSlotTime(time, req.user);
  }
}
