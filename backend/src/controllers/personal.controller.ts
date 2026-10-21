import { Body, Controller, Get, Patch, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../../../lib/access';
import { AuthService } from '../services/auth.service';
@Controller('me')
export class PersonalController {
 constructor(private readonly auth: AuthService) {}
 @Get('tasks') tasks(@Req() req: Request & { user: AuthUser }) { return this.auth.ownTasks(req.user); }
 @Patch('tasks/:id') progress(@Req() req: Request & { user: AuthUser }, @Param('id') id: string, @Body() body: unknown) { return this.auth.progress(req.user, id, body); }
}
