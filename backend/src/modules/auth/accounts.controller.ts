import { Body, Controller, Get, Post, Patch, Param } from '@nestjs/common';
import { AuthService } from './auth.service';
@Controller('accounts')
export class AccountsController {
 constructor(private readonly auth: AuthService) {}
 @Get() list() { return this.auth.accounts(); }
 @Patch(':id') change(@Param('id') id: string, @Body() body: unknown) { return this.auth.changeAccount(id, body); }
 @Post(':id/invite') invite(@Param('id') id: string) { return this.auth.invite(id); }
}
