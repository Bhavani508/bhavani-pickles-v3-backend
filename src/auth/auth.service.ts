import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  async register(registerDto: RegisterDto) {
    const user = await this.usersService.create(registerDto);
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    this.emailService.sendWelcome({ name: user.name, email: user.email });

    // Send email verification
    const verifyToken = await this.usersService.createEmailVerificationToken(user.id);
    const clientUrl = this.configService.get('FRONTEND_URL', 'https://www.bhavanipickles.com');
    const verifyUrl = `${clientUrl}/auth/verify-email?token=${verifyToken}`;
    this.emailService.sendVerificationEmail({ name: user.name, email: user.email, verifyUrl });

    return { user: this.sanitizeUser(user), ...tokens };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user || !user.isActive)
      throw new UnauthorizedException('Invalid credentials');

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid)
      throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  private async generateTokens(userId: string, email: string, role: Role) {
    const payload = { sub: userId, email, role };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRES_IN', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);
    return { accessToken, refreshToken };
  }

  async refreshToken(oldRefreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(oldRefreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });
      const user = await this.usersService.findById(payload.sub);
      if (!user || !user.isActive) throw new UnauthorizedException();

      // Rotate: issue both new access and refresh tokens
      const tokens = await this.generateTokens(user.id, user.email, user.role);
      return tokens;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const result = await this.usersService.createPasswordResetToken(email);
    if (!result) return; // don't reveal whether email exists

    const clientUrl = this.configService.get('FRONTEND_URL', 'https://www.bhavanipickles.com');
    const resetUrl = `${clientUrl}/auth/reset-password?token=${result.token}`;

    this.emailService.sendPasswordReset({ name: result.name, email, resetUrl });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    return this.usersService.resetPassword(token, newPassword);
  }

  async verifyEmail(token: string) {
    const user = await this.usersService.verifyEmail(token);
    return { message: 'Email verified successfully', email: user.email };
  }

  async resendVerification(userId: string) {
    const user = await this.usersService.findById(userId);
    if (user.isEmailVerified) {
      return { message: 'Email is already verified' };
    }

    const verifyToken = await this.usersService.createEmailVerificationToken(user.id);
    const clientUrl = this.configService.get('FRONTEND_URL', 'https://www.bhavanipickles.com');
    const verifyUrl = `${clientUrl}/auth/verify-email?token=${verifyToken}`;
    this.emailService.sendVerificationEmail({ name: user.name, email: user.email, verifyUrl });

    return { message: 'Verification email sent' };
  }

  private sanitizeUser(user: any) {
    const { password, ...sanitized } = user.toObject ? user.toObject() : user;
    return sanitized;
  }
}
