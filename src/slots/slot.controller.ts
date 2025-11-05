// import {
//   Controller,
//   Get,
//   Post,
//   Patch,
//   Delete,
//   Body,
//   Query,
//   UseGuards,
//   Req,
//   ForbiddenException,
// } from '@nestjs/common';
// import { SlotService } from './slot.service';
// import { CreateSlotDto } from './dto/create-slot.dto';
// import { UpdateSlotDto } from './dto/update-slot.dto';
// import { ToggleSlotDto } from './dto/toggle-slot.dto';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { RolesGuard } from '../auth/guards/roles.guard';
// import { Roles } from '../auth/decorators/roles.decorator';
// import { Role } from '../auth/roles.enum';

// interface AuthenticatedRequest extends Request {
//   user?: {
//     id: string;
//     email: string;
//     role: Role;
//   };
// }

// @Controller('slots')
// export class SlotController {
//   constructor(private readonly slotService: SlotService) {}

//   // Test cache
//   @Get('cache-test')
//   async cacheTest() {
//     return this.slotService.testCache();
//   }

//   // Public: get slots for a date
//   @Get()
//   async findAll(@Query('date') date?: string) {
//     return this.slotService.findAll(date);
//   }

//   // Admin: create slot
//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles(Role.ADMIN, Role.SUPER_ADMIN)
//   @Post()
//   create(@Body() dto: CreateSlotDto, @Req() req: AuthenticatedRequest) {
//     if (!req.user) throw new ForbiddenException('Unauthorized');
//     return this.slotService.create(dto, req.user);
//   }

//   // Admin: update slot
//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles(Role.ADMIN, Role.SUPER_ADMIN)
//   @Patch()
//   update(
//     @Query('date') date: string,
//     @Query('startTime') startTime: string,
//     @Body() dto: Partial<Omit<UpdateSlotDto, 'date' | 'startTime'>>,
//     @Req() req: AuthenticatedRequest,
//   ) {
//     if (!req.user) throw new ForbiddenException('Unauthorized');
//     return this.slotService.update(date, startTime, dto, req.user);
//   }

//   // Admin: toggle slot active
//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles(Role.ADMIN, Role.SUPER_ADMIN)
//   @Patch('toggle')
//   toggle(
//     @Query('date') date: string,
//     @Query('startTime') startTime: string,
//     @Body() dto: ToggleSlotDto,
//     @Req() req: AuthenticatedRequest,
//   ) {
//     if (!req.user) throw new ForbiddenException('Unauthorized');
//     return this.slotService.toggleStatus(date, startTime, dto, req.user);
//   }

//   // Admin: delete slot
//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles(Role.ADMIN, Role.SUPER_ADMIN)
//   @Delete()
//   remove(
//     @Query('date') date: string,
//     @Query('startTime') startTime: string,
//     @Req() req: AuthenticatedRequest,
//   ) {
//     if (!req.user) throw new ForbiddenException('Unauthorized');
//     return this.slotService.remove(date, startTime, req.user);
//   }

//   // Admin: update global amount
//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles(Role.ADMIN, Role.SUPER_ADMIN)
//   @Patch('update-global-amount')
//   updateGlobalAmount(
//     @Body('amount') amount: number,
//     @Req() req: AuthenticatedRequest,
//   ) {
//     if (!req.user) throw new ForbiddenException('Unauthorized');
//     return this.slotService.updateGlobalAmount(amount, req.user);
//   }

//   // Admin: add slot time
//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles(Role.ADMIN, Role.SUPER_ADMIN)
//   @Patch('add-slot-time')
//   addSlotTime(
//     @Body('time') time: string,
//     @Req() req: AuthenticatedRequest,
//   ) {
//     if (!req.user) throw new ForbiddenException('Unauthorized');
//     return this.slotService.addSlotTime(time, req.user);
//   }

//   // Admin: remove slot time
//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles(Role.ADMIN, Role.SUPER_ADMIN)
//   @Patch('remove-slot-time')
//   removeSlotTime(
//     @Body('time') time: string,
//     @Req() req: AuthenticatedRequest,
//   ) {
//     if (!req.user) throw new ForbiddenException('Unauthorized');
//     return this.slotService.removeSlotTime(time, req.user);
//   }
// }


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
  Param,
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

  /** ✅ Test Redis cache */
  @Get('cache-test')
  async cacheTest() {
    return this.slotService.testCache();
  }

  /** ✅ Public: get all slots for a date */
  @Get()
  async findAll(@Query('date') date?: string) {
    return this.slotService.findAll(date);
  }

  /** ✅ Public: get only available slots */
  @Get('available')
  async getAvailable(@Query('date') date: string) {
    return this.slotService.getAvailableSlots(date);
  }

  /** ✅ Public: get system slot settings */
  @Get('settings')
  async getSettings() {
    return this.slotService.getSettings();
  }

  /** ✅ Admin: update global system settings */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Patch('settings')
  async updateSettings(@Body() updates: any, @Req() req: AuthenticatedRequest) {
    if (!req.user) throw new ForbiddenException('Unauthorized');
    return this.slotService.updateSettings(updates, req.user);
  }

  @Patch('global-settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async updateGlobalSettings(@Body() updates: any, @Req() req) {
    const user = req.user;
    return this.slotService.updateGlobalSettings(updates, user);
  }

  /** ✅ Admin: create a new slot */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post()
  create(@Body() dto: CreateSlotDto, @Req() req: AuthenticatedRequest) {
    if (!req.user) throw new ForbiddenException('Unauthorized');
    return this.slotService.create(dto, req.user);
  }

  /** ✅ Admin: update an existing slot */
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

  /** ✅ Admin: toggle slot active/inactive */
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

  /** ✅ Admin: delete a slot */
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

  /** ✅ Admin: add a new slot time to master list */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Patch('settings/add-time/:time')
  async addTime(@Param('time') time: string, @Req() req: AuthenticatedRequest) {
    if (!req.user) throw new ForbiddenException('Unauthorized');
    return this.slotService.addSlotTimeToMaster(time, req.user);
  }

  /** ✅ Admin: remove a slot time from master list */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Patch('settings/remove-time/:time')
  async removeTime(
    @Param('time') time: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.user) throw new ForbiddenException('Unauthorized');
    return this.slotService.removeSlotTimeFromMaster(time, req.user);
  }

  /** ✅ Admin: toggle time (enable/disable globally) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Patch('settings/toggle-time/:time')
  async toggleTime(
    @Param('time') time: string,
    @Body('value') value: boolean,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.user) throw new ForbiddenException('Unauthorized');
    return this.slotService.toggleSlotTime(time, value, req.user);
  }

  /** ✅ Admin: update price (global, per time, or per date) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Patch('settings/amount')
  async updateAmount(
    @Body('scope') scope: 'global' | 'time' | 'date',
    @Body('key') key: string,
    @Body('amount') amount: number,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.user) throw new ForbiddenException('Unauthorized');
    return this.slotService.updateAmount(scope, key ?? null, amount, req.user);
  }


  // @Patch('single')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  // async updateSingleSlot(
  //   @Query('date') date: string,
  //   @Body() body: { time: string; isActive?: boolean; amount?: number; status?: string },
  //   @Req() req,
  // ) {
  //   const { time, isActive, amount, status } = body;
  //   if (!date || !time) {
  //     throw new Error('Date and time are required.');
  //   }
  //   return this.slotService.updateSingleSlot(date, time, { isActive, amount, status }, req.user);
  // }

@Patch('update-single')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
async updateSingleSlot(
  @Query('date') date: string,
  @Body() body: { 
    time: string; 
    isActive?: boolean; 
    amount?: number; 
    status?: 'available' | 'booked' | 'unavailable'; 
  },
  @Req() req: any, // your guard ensures user exists
) {
  const { time, isActive, amount, status } = body;

  if (!date || !time) {
    throw new Error('Date and time are required.');
  }

  return this.slotService.updateSingleSlot(date, time, { isActive, amount, status }, req.user);
}


  
}

