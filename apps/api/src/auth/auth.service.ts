import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { customAlphabet } from 'nanoid';
import { LoginRequestMethod, LoginRequestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { SessionService, SessionMeta, IssuedSession } from './session.service';
import { LoginRequestGateway } from './login-request.gateway';
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
    private readonly sessions: SessionService,
    private readonly gateway: LoginRequestGateway,
  ) {}

  async register(dto: RegisterDto, meta: SessionMeta): Promise<IssuedSession> {
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.identity.createUser({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
    });
    return this.sessions.issueSession(user.id, user.ndyId, meta);
  }

  async login(dto: LoginDto, meta: SessionMeta): Promise<IssuedSession> {
    const user = await this.identity.findByEmail(dto.email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Incorrect email or password.');
    }
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Incorrect email or password.');
    }
    return this.sessions.issueSession(user.id, user.ndyId, meta);
  }

  async refresh(
    refreshToken: string,
    meta: SessionMeta,
  ): Promise<IssuedSession> {
    return this.sessions.rotateSession(refreshToken, meta);
  }

  async logout(refreshToken: string): Promise<void> {
    return this.sessions.revokeSession(refreshToken);
  }

  /**
   * Step 1 of the QR / deep-link flow: a browser or mobile page asks for a
   * fresh, single-use login request. The token goes into the QR code (desktop)
   * or the universal-link URL (mobile) — NDYAPPS calls back with it once the
   * person approves or denies inside the app.
   */
  async createLoginRequest(
    dto: CreateLoginRequestDto,
    meta: { ip?: string; location?: string },
  ) {
    const token = generateToken();
    return this.prisma.loginRequest.create({
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
  }

  async getLoginRequestStatus(token: string) {
    return this.findActiveOrExpire(token);
  }

  /**
   * Step 2: called from inside NDYAPPS once the user taps Approve, using the
   * app's own authenticated session (enforced by JwtAuthGuard on the route) —
   * so this can only ever succeed from a device that's already logged in as
   * that user.
   */
  async approveLoginRequest(token: string, userId: string) {
    const loginRequest = await this.findActiveOrExpire(token);
    if (loginRequest.status !== LoginRequestStatus.PENDING) {
      throw new BadRequestException(
        `This login request is already ${loginRequest.status.toLowerCase()}.`,
      );
    }

    // Single-use enforcement: the WHERE clause only matches while still PENDING,
    // so a double-tap or a replayed call updates zero rows the second time.
    const result = await this.prisma.loginRequest.updateMany({
      where: { token, status: LoginRequestStatus.PENDING },
      data: {
        status: LoginRequestStatus.APPROVED,
        approvedAt: new Date(),
        userId,
      },
    });

    if (result.count === 0) {
      throw new ConflictException('This login request was already handled.');
    }

    // Approving a login request is proof the person has NDYAPPS and is
    // using it — that's exactly the signal ndyappsConnected exists to
    // record. Only flips false -> true, never touches an already-connected
    // user's timestamp.
    await this.prisma.user.updateMany({
      where: { id: userId, ndyappsConnected: false },
      data: { ndyappsConnected: true, ndyappsConnectedAt: new Date() },
    });

    this.gateway.publishStatus(token, LoginRequestStatus.APPROVED);
    return this.prisma.loginRequest.findUniqueOrThrow({ where: { token } });
  }

  async denyLoginRequest(token: string) {
    const loginRequest = await this.findActiveOrExpire(token);
    if (loginRequest.status !== LoginRequestStatus.PENDING) {
      throw new BadRequestException(
        `This login request is already ${loginRequest.status.toLowerCase()}.`,
      );
    }

    await this.prisma.loginRequest.updateMany({
      where: { token, status: LoginRequestStatus.PENDING },
      data: { status: LoginRequestStatus.DENIED, deniedAt: new Date() },
    });

    this.gateway.publishStatus(token, LoginRequestStatus.DENIED);
    return this.prisma.loginRequest.findUniqueOrThrow({ where: { token } });
  }

  /**
   * Step 3: the desktop browser redeems an APPROVED request for a real
   * session — the "exchange a one-time code for a token" half of the
   * OAuth2-style handshake described in the proposal. Single-use, enforced
   * the same atomic way as approve/deny.
   */
  async exchangeLoginRequest(
    token: string,
    meta: SessionMeta,
  ): Promise<IssuedSession> {
    const loginRequest = await this.findActiveOrExpire(token);
    if (
      loginRequest.status !== LoginRequestStatus.APPROVED ||
      !loginRequest.userId
    ) {
      throw new BadRequestException(
        'This login request has not been approved.',
      );
    }
    if (loginRequest.sessionIssuedAt) {
      throw new ConflictException(
        'This login request was already exchanged for a session.',
      );
    }

    const result = await this.prisma.loginRequest.updateMany({
      where: {
        token,
        status: LoginRequestStatus.APPROVED,
        sessionIssuedAt: null,
      },
      data: { sessionIssuedAt: new Date() },
    });
    if (result.count === 0) {
      throw new ConflictException(
        'This login request was already exchanged for a session.',
      );
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: loginRequest.userId },
    });
    return this.sessions.issueSession(user.id, user.ndyId, meta);
  }

  private async findActiveOrExpire(token: string) {
    const loginRequest = await this.prisma.loginRequest.findUnique({
      where: { token },
    });
    if (!loginRequest) {
      throw new BadRequestException('Unknown or expired login request.');
    }
    if (
      loginRequest.status === LoginRequestStatus.PENDING &&
      loginRequest.expiresAt < new Date()
    ) {
      const expired = await this.prisma.loginRequest.update({
        where: { token },
        data: { status: LoginRequestStatus.EXPIRED },
      });
      this.gateway.publishStatus(token, LoginRequestStatus.EXPIRED);
      return expired;
    }
    return loginRequest;
  }
}

export { LoginRequestMethod };
