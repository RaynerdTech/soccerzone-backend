import { Controller, Post, Body, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';

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
}
