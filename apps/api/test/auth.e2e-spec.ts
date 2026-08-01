import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from '../src/auth/session-cookie.util';

// Runs against whatever DATABASE_URL apps/api/.env points at — the same
// local dev Postgres the rest of this project's manual testing has used
// all along, not an isolated test database. Each run creates its own
// uniquely-timestamped user rather than relying on (or leaving behind)
// any specific fixture data.
describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  const email = `e2e-${Date.now()}@example.com`;
  const password = 'TestPassword123!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    // Keeps repeated local runs from accumulating e2e-*@example.com users
    // in the dev database — best-effort, since a couple of tests above
    // intentionally never got this far (e.g. the duplicate-email case).
    const prisma = app.get(PrismaService);
    await prisma.user.deleteMany({ where: { email } }).catch(() => {});
    await app.close();
  });

  function getCookie(res: request.Response, name: string): string | undefined {
    const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
    const match = raw?.find((c) => c.startsWith(`${name}=`));
    return match?.split(';')[0];
  }

  // supertest types response bodies as `any` — this is the one place that
  // casts, so assertions elsewhere get a real type instead of unsafe `any`
  // member access.
  function body<T>(res: request.Response): T {
    return res.body as T;
  }

  it('registers a new user and sets httpOnly session cookies, not just a JSON body', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, fullName: 'E2E Test User' })
      .expect(201);

    const registered = body<{ accessToken: string; refreshToken: string }>(res);
    expect(registered.accessToken).toEqual(expect.any(String));
    expect(registered.refreshToken).toEqual(expect.any(String));

    const rawCookies = res.headers['set-cookie'] as unknown as string[];
    const accessCookie = rawCookies.find((c) =>
      c.startsWith(`${ACCESS_TOKEN_COOKIE}=`),
    );
    const refreshCookie = rawCookies.find((c) =>
      c.startsWith(`${REFRESH_TOKEN_COOKIE}=`),
    );
    expect(accessCookie).toContain('HttpOnly');
    expect(accessCookie).toContain('SameSite=Lax');
    expect(refreshCookie).toContain('HttpOnly');
  });

  it('rejects registering the same email twice', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, fullName: 'Duplicate' })
      .expect(409);
  });

  it('rejects a login with the wrong password', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'WrongPassword123!' })
      .expect(401);
  });

  it('logs in and authenticates /auth/me using only the cookie — no Authorization header', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    const accessCookie = getCookie(loginRes, ACCESS_TOKEN_COOKIE);
    expect(accessCookie).toBeDefined();

    const meRes = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', accessCookie!)
      .expect(200);

    const me = body<{ email: string; id: string }>(meRes);
    expect(me.email).toBe(email);
    expect(me.id).toEqual(expect.any(String));
  });

  it('rejects /auth/me with no cookie and no Authorization header', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('rotates the session on refresh and revokes the old refresh token', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    const refreshCookie = getCookie(loginRes, REFRESH_TOKEN_COOKIE);

    const refreshRes = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', refreshCookie!)
      .send({})
      .expect(201);
    const rotatedCookie = getCookie(refreshRes, REFRESH_TOKEN_COOKIE);
    expect(rotatedCookie).toBeDefined();
    expect(rotatedCookie).not.toBe(refreshCookie);

    // The old refresh token was single-use — replaying it must now fail.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', refreshCookie!)
      .send({})
      .expect(401);
  });

  it('refresh 400s when there is no refresh token anywhere (cookie or body)', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({})
      .expect(400);
  });

  it('logout clears both cookies and revokes the session', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    const accessCookie = getCookie(loginRes, ACCESS_TOKEN_COOKIE);
    const refreshCookie = getCookie(loginRes, REFRESH_TOKEN_COOKIE);

    const logoutRes = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', [accessCookie!, refreshCookie!])
      .send({})
      .expect(201);

    const rawCookies = logoutRes.headers['set-cookie'] as unknown as string[];
    const clearedAccessRaw = rawCookies.find((c) =>
      c.startsWith(`${ACCESS_TOKEN_COOKIE}=`),
    );
    expect(clearedAccessRaw).toMatch(/Expires=Thu, 01 Jan 1970/);

    // The revoked refresh token can no longer mint a new session.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', refreshCookie!)
      .send({})
      .expect(401);
  });
});
