import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { customAlphabet } from 'nanoid';
import { LoginRequestMethod, LoginRequestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { CreateLoginRequestDto } from './dto/create-login-request.dto';

const SALT_ROUNDS = 12;
const LOGIN_REQUEST_TTL_MS = 90_000; // 90 seconds, per the desktop-QR / deep-link spec
const generateToken = customAlphabet(
  'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789',
  32,
);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.identity.createUser({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
    });
    return this.toPublicUser(user);
  }

  async validateLogin(dto: LoginDto) {
    const user = await this.identity.findByEmail(dto.email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Incorrect email or password.');
    }
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Incorrect email or password.');
    }
    return this.toPublicUser(user);
  }

  /**
   * Step 1 of the QR / deep-link flow: a browser or mobile page asks for a
   * fresh, single-use login request. The token goes into the QR code (desktop)
   * or the universal-link URL (mobile) — NDYAPPS calls back with it once the
   * person approves or denies inside the app.
   */
  async createLoginRequest(dto: CreateLoginRequestDto, meta: { ip?: string; location?: string }) {
    const token = generateToken();
    const loginRequest = await this.prisma.loginRequest.create({
      data: {
        token,
        method: dto.method,
        requestingIp: meta.ip,
        requestingDevice: dto.device,
        requestingBrowser: dto.browser,
        requestingLocation: meta.location,
        expiresAt: new Date(Date.now() + LOGIN_REQUEST_TTL_MS),
      },
    });
    return loginRequest;
  }

  async getLoginRequestStatus(token: string) {
    const loginRequest = await this.findActiveOrExpire(token);
    return loginRequest;
  }

  /**
   * Step 2: called from inside NDYAPPS once the user taps Approve, using the
   * app's own authenticated session — so this can only ever succeed from a
   * device that's already logged in as that user.
   */
  async approveLoginRequest(token: string, userId: string) {
    const loginRequest = await this.findActiveOrExpire(token);
    if (loginRequest.status !== LoginRequestStatus.PENDING) {
      throw new BadRequestException(`This login request is already ${loginRequest.status.toLowerCase()}.`);
    }

    // Single-use enforcement: the WHERE clause only matches while still PENDING,
    // so a double-tap or a replayed call updates zero rows the second time.
    const result = await this.prisma.loginRequest.updateMany({
      where: { token, status: LoginRequestStatus.PENDING },
      data: { status: LoginRequestStatus.APPROVED, approvedAt: new Date(), userId },
    });

    if (result.count === 0) {
      throw new ConflictException('This login request was already handled.');
    }

    return this.prisma.loginRequest.findUniqueOrThrow({ where: { token } });
  }

  async denyLoginRequest(token: string) {
    const loginRequest = await this.findActiveOrExpire(token);
    if (loginRequest.status !== LoginRequestStatus.PENDING) {
      throw new BadRequestException(`This login request is already ${loginRequest.status.toLowerCase()}.`);
    }

    await this.prisma.loginRequest.updateMany({
      where: { token, status: LoginRequestStatus.PENDING },
      data: { status: LoginRequestStatus.DENIED, deniedAt: new Date() },
    });

    return this.prisma.loginRequest.findUniqueOrThrow({ where: { token } });
  }

  private async findActiveOrExpire(token: string) {
    const loginRequest = await this.prisma.loginRequest.findUnique({ where: { token } });
    if (!loginRequest) {
      throw new BadRequestException('Unknown or expired login request.');
    }
    if (loginRequest.status === LoginRequestStatus.PENDING && loginRequest.expiresAt < new Date()) {
      return this.prisma.loginRequest.update({
        where: { token },
        data: { status: LoginRequestStatus.EXPIRED },
      });
    }
    return loginRequest;
  }

  private toPublicUser(user: { passwordHash: string | null; [key: string]: unknown }) {
    const { passwordHash, ...publicUser } = user;
    return publicUser;
  }
}

export { LoginRequestMethod };
