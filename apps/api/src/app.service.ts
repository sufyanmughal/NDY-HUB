import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  // Root path — was NestJS's scaffolding-default "Hello World!" string,
  // replaced with a minimal health response. Deliberately reveals nothing
  // about the service beyond "it's up" (no version number, no framework
  // name, no environment details) — a load balancer/uptime monitor hitting
  // this needs a 200 and a stable shape, not diagnostic detail that would
  // just help someone fingerprint the stack.
  getHealth(): { status: string } {
    return { status: 'ok' };
  }
}
