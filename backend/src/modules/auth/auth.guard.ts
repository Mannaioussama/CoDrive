import { CanActivate, ExecutionContext, Injectable, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { canManage, type ManagementModule, type AuthUser } from '../../../../lib/access';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PersonalController } from './personal.controller';
import { IS_PUBLIC_KEY } from './public.decorator';

function headerHost(value: string | string[] | undefined): string | undefined {
 if (!value) return undefined;
 const raw = Array.isArray(value) ? value[0] : value;
 return raw.split(',')[0]?.trim() || undefined;
}

@Injectable()
export class AuthGuard implements CanActivate {
 constructor(private readonly auth: AuthService, private readonly reflector: Reflector) {}
 async canActivate(context: ExecutionContext) {
  if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
  const req = context.switchToHttp().getRequest<Request & { user: AuthUser }>();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin) {
   let host: string; try { host = new URL(req.headers.origin).host; } catch { throw new ForbiddenException(); }
   const forwarded = headerHost(req.headers['x-forwarded-host']);
   const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
   if (host !== req.headers.host && host !== forwarded && !allowed.includes(host)) throw new ForbiddenException('Origine refusée.');
  }
  if (context.getClass() === AuthController) return true;
  const user = await this.auth.user(req);
  if (!user) throw new UnauthorizedException('Connectez-vous pour accéder à votre espace.');
  req.user = user;
  if (context.getClass() === PersonalController) return true;
  if (user.role === 'ADMIN') return true;
  const route = req.path.split('/')[2];
  const module = ({ resources: 'resources', assignments: 'resources', vehicles: 'vehicles', reservations: 'reservations', billing: 'billing', complaints: 'complaints' } as Record<string, ManagementModule>)[route];
  if (module && (['GET', 'HEAD'].includes(req.method) || canManage(user.role, module))) return true;
  if (route === 'settings' && req.method === 'GET') return true;
  throw new ForbiddenException('Vous n’avez pas la permission d’accéder à cette fonctionnalité.');
 }
}
