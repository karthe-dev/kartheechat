import { Body, Controller, Post, Get, UseGuards, Req, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { AuthPayload } from 'shared';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService, private userService: UserService) {}

  @Post('register')
  register(@Body() dto: AuthPayload) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: AuthPayload) {
    return this.authService.login(dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async me(@Req() req: any) {
    const { password, ...user } = req.user;
    return { ...user, avatarUrl: user.avatar_url, theme: user.theme || 'light' };
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('users')
  async users() {
    const all = await this.userService.getAll();
    return all.map((u: any) => ({ id: u.id, username: u.username, avatarUrl: u.avatar_url }));
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(@Req() req: any, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No file provided');
    if (file.size > 2 * 1024 * 1024) throw new BadRequestException('File exceeds 2MB');
    if (!file.mimetype.startsWith('image/')) throw new BadRequestException('Only images allowed');
    const url = await this.userService.uploadAvatar(file.buffer, file.originalname, file.mimetype, req.user.id);
    const user = await this.userService.updateAvatar(req.user.id, url);
    return { avatarUrl: url, user: { id: user.id, username: user.username, avatarUrl: url } };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('reset-password')
  async resetPassword(@Req() req: any, @Body() dto: { oldPassword: string; newPassword: string }) {
    const ok = await this.userService.resetPassword(req.user.id, dto.oldPassword, dto.newPassword);
    if (!ok) throw new BadRequestException('Current password is incorrect');
    return { success: true };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('theme')
  async updateTheme(@Req() req: any, @Body() dto: { theme: string }) {
    return this.userService.updateTheme(req.user.id, dto.theme);
  }
}
