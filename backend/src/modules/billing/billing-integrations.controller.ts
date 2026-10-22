import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { ApiKeyGuard } from './api-key.guard';
import { BillingService } from './billing.service';

@ApiTags('Comptabilité · intégrations')
@Controller('billing/integrations')
@Public()
@UseGuards(ApiKeyGuard)
export class BillingIntegrationsController {
 constructor(private readonly billing: BillingService) {}

 @Post('receipt')
 receipt(@Body() body: unknown) {
  return this.billing.integrationReceipt(body);
 }
}
