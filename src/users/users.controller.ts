import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '../auth/roles.enum';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// ✅ Extend Express Request to include `user`
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: Role;
  };
}

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ✅ Create User / Admin (role-limited)
  @Post()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async create(@Body() createUserDto: any, @Req() req: AuthenticatedRequest) {
    const loggedInUser = req.user;
    if (!loggedInUser) throw new ForbiddenException('Unauthorized');

    if (loggedInUser.role === Role.SUPER_ADMIN) {
      return this.usersService.create(createUserDto);
    }

    if (loggedInUser.role === Role.ADMIN) {
      if (createUserDto.role && createUserDto.role !== Role.USER) {
        throw new ForbiddenException('Admins can only create users');
      }
      return this.usersService.create({ ...createUserDto, role: Role.USER });
    }

    throw new ForbiddenException('You are not allowed to create users');
  }

  // ✅ Get all users
  @Get()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async findAll() {
    return this.usersService.findAll();
  }

  // ✅ Get user by ID
  @Get(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  // ✅ Update user
  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: any,
    @Req() req: AuthenticatedRequest,
  ) {
    const loggedInUser = req.user;
    if (!loggedInUser) throw new ForbiddenException('Unauthorized');

    if (loggedInUser.role === Role.ADMIN && updateUserDto.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Admins cannot modify Super Admins');
    }

    return this.usersService.update(id, updateUserDto);
  }

  // ✅ Delete user
  @Delete(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const loggedInUser = req.user;
    if (!loggedInUser) throw new ForbiddenException('Unauthorized');

    if (loggedInUser.role === Role.ADMIN) {
      const target = await this.usersService.findOne(id);
      if (!target) {
        throw new ForbiddenException('User not found');
      }
      if (target.role === Role.SUPER_ADMIN) {
        throw new ForbiddenException('Admins cannot delete Super Admins');
      }
    }

    return this.usersService.remove(id);
  }
}
