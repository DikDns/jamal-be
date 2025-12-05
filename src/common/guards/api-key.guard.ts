import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = this.extractApiKey(request);
    const expected = process.env.COLLAB_API_KEY;

    if (expected && (!apiKey || apiKey !== expected)) {
      throw new ForbiddenException('Invalid or missing API key');
    }

    return true;
  }

  private extractApiKey(request: any): string | undefined {
    // 1. Check Authorization header (Bearer token)
    const authHeader = request.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    // 2. Check custom header (X-API-Key)
    if (request.headers?.['x-api-key']) {
      return request.headers['x-api-key'];
    }

    // 3. Check cookies (HttpOnly cookie named 'collabKey' or 'apiKey')
    if (request.cookies) {
      return request.cookies['collabKey'] || request.cookies['apiKey'];
    }

    return undefined;
  }
}
