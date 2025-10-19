import { Controller, Post, Body, Query, Get, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  
  @Post('login')
  signin(@Body() dto: SigninDto) {
    return this.authService.signin(dto);
  }

  // ✅ Forgot password endpoint
  @Post('forgot-password')
  forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  // ✅ Reset password endpoint
  @Post('reset-password')
  resetPassword(
    @Query('token') token: string,
    @Body('password') password: string,
  ) {
    return this.authService.resetPassword(token, password);
  }

  @UseGuards(JwtAuthGuard)
@Get('profile')
async getProfile(@Req() req) {
  return this.authService.getProfile(req.user.id);
}
}
