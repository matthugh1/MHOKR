import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

interface RateLimitWindow {
  count: number;
  windowStart: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly limit = 30;
  private readonly windowMs = 60000;
  private readonly counters = new Map<string, RateLimitWindow>();

  private cleanup() {
    const now = Date.now();
    for (const [userId, window] of this.counters.entries()) {
      if (now - window.windowStart >= this.windowMs) {
        this.counters.delete(userId);
      }
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      return true;
    }

    const userId = user.id;
    const now = Date.now();

    this.cleanup();

    const window = this.counters.get(userId);

    if (!window) {
      this.counters.set(userId, { count: 1, windowStart: now });
      return true;
    }

    if (now - window.windowStart >= this.windowMs) {
      window.count = 1;
      window.windowStart = now;
      return true;
    }

    if (window.count >= this.limit) {
      throw new HttpException(
        'Rate limit exceeded for privileged mutations.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    window.count += 1;
    return true;
  }
}



