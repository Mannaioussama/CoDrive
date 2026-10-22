import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingIntegrationsController } from './billing-integrations.controller';
import { BillingService } from './billing.service';
import { ApiKeyGuard } from './api-key.guard';

@Module({
 controllers: [BillingController, BillingIntegrationsController],
 providers: [BillingService, ApiKeyGuard],
 exports: [BillingService],
})
export class BillingModule {}
