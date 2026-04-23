import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { AuthPayload, AuthResponse } from 'shared';

@Injectable()
export class AuthService {
  constructor(private userService: UserService, private jwtService: JwtService) {}

  async register(dto: AuthPayload): Promise<AuthResponse> {
    const existing = await this.userService.findByUsername(dto.username);
    if (existing) throw new ConflictException('Username taken');
    const user = await this.userService.create(dto.username, dto.password);
    const token = this.jwtService.sign({ sub: user.id, username: user.username });
    return { token, user: { id: user.id, username: user.username, avatarUrl: user.avatar_url, theme: user.theme || 'light' } };
  }

  async login(dto: AuthPayload): Promise<AuthResponse> {
    const user = await this.userService.findByUsername(dto.username);
    if (!user || !(await this.userService.validatePassword(dto.password, user.password!))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const token = this.jwtService.sign({ sub: user.id, username: user.username });
    return { token, user: { id: user.id, username: user.username, avatarUrl: user.avatar_url, theme: user.theme || 'light' } };
  }
}
