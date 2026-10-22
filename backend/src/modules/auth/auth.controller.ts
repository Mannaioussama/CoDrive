import { Body, Controller, Get, Post, Req, Res, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
@Controller('auth')
export class AuthController {
 constructor(private readonly auth: AuthService) {}
 @Get('status') status() { return this.auth.status(); }
 @Get('me') async me(@Req() req: Request) { const user = await this.auth.user(req); if (!user) throw new UnauthorizedException(); return user; }
 @Post('setup') setup() { throw new ForbiddenException('Inscription publique fermée. Contactez votre administrateur.'); }
 @Post('activate') activate(@Body() body: unknown, @Req() req: Request) { return this.auth.activate(body, req); }
 @Post('login') login(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) { return this.auth.login(body, req, res); }
 @Post('logout') logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) { return this.auth.logout(req, res); }
}
