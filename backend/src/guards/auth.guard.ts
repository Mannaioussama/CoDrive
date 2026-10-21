import { CanActivate, ExecutionContext, Injectable, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { canManage, type ManagementModule, type AuthUser } from '../../../lib/access';
import { AuthService } from '../services/auth.service';
import { AuthController } from '../controllers/auth.controller';
import { PersonalController } from '../controllers/personal.controller';
@Injectable()
export class AuthGuard implements CanActivate {
 constructor(private readonly auth: AuthService) {}
 async canActivate(context: ExecutionContext) {
  const req = context.switchToHttp().getRequest<Request & { user: AuthUser }>();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin) {
   let host: string; try { host = new URL(req.headers.origin).host; } catch { throw new ForbiddenException(); }
   if (host !== req.headers.host && host !== req.headers['x-forwarded-host']) throw new ForbiddenException('Origine refusée.');
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
