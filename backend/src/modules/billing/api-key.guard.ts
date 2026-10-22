import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
 canActivate(context: ExecutionContext) {
  const expected = process.env.N8N_API_KEY || '';
  if (!expected) throw new UnauthorizedException('Intégrations désactivées (N8N_API_KEY manquant).');
  const req = context.switchToHttp().getRequest<Request>();
  const provided = String(req.headers['x-api-key'] || '');
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException('Clé API invalide.');
  return true;
 }
}
