import {
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import type { LoginRequestStatus } from '@prisma/client';

/**
 * Lets the desktop QR screen react the instant NDYAPPS approves or denies,
 * instead of polling GET /auth/login-request/:token in a loop. The channel
 * only ever carries a status string — never a token or session — so there's
 * nothing sensitive to protect here beyond normal CORS.
 */
@WebSocketGateway({
  cors: {
    origin: process.env.WEB_APP_URL ?? 'http://localhost:3001',
    credentials: true,
  },
})
export class LoginRequestGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(LoginRequestGateway.name);

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  @SubscribeMessage('login-request:subscribe')
  async handleSubscribe(client: Socket, token: string) {
    await client.join(roomFor(token));
  }

  publishStatus(token: string, status: LoginRequestStatus) {
    void this.server
      .to(roomFor(token))
      .emit('login-request:status', { token, status });
  }
}

function roomFor(token: string): string {
  return `login-request:${token}`;
}
