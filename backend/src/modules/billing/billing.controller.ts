import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthUser } from '../../../../lib/access';
import { BillingService } from './billing.service';

@ApiTags('Comptabilité')
@Controller('billing')
export class BillingController {
 constructor(private readonly billing: BillingService) {}

 @Get('kpis') kpis() { return this.billing.kpis(); }
 @Get('settings') settings() { return this.billing.settings(); }
 @Put('settings') saveSettings(@Body() body: unknown) { return this.billing.saveSettings(body); }
 @Get('tarifs/categories') categories() { return this.billing.categories(); }

 @Get('tarifs/base-rates') baseRates() { return this.billing.list('billing_base_rates'); }
 @Put('tarifs/base-rates') saveBaseRate(@Body() body: Record<string, unknown>) {
  return this.billing.upsertRule('billing_base_rates', body, ['id', 'category', 'dailyMillimes', 'valideDepuis', 'active']);
 }
 @Delete('tarifs/base-rates/:id') delBaseRate(@Param('id') id: string) { return this.billing.removeRule('billing_base_rates', id); }

 @Get('tarifs/seasons') seasons() { return this.billing.list('billing_seasons'); }
 @Put('tarifs/seasons') saveSeason(@Body() body: Record<string, unknown>) {
  return this.billing.upsertRule('billing_seasons', body, ['id', 'name', 'dateDebut', 'dateFin', 'coefficientBp', 'categories', 'active']);
 }
 @Delete('tarifs/seasons/:id') delSeason(@Param('id') id: string) { return this.billing.removeRule('billing_seasons', id); }

 @Get('tarifs/duration-discounts') durationDiscounts() { return this.billing.list('billing_duration_discounts'); }
 @Put('tarifs/duration-discounts') saveDuration(@Body() body: Record<string, unknown>) {
  return this.billing.upsertRule('billing_duration_discounts', body, ['id', 'minDays', 'discountBp', 'active']);
 }
 @Delete('tarifs/duration-discounts/:id') delDuration(@Param('id') id: string) { return this.billing.removeRule('billing_duration_discounts', id); }

 @Get('tarifs/partners') partners() { return this.billing.list('billing_partner_rates'); }
 @Put('tarifs/partners') savePartner(@Body() body: Record<string, unknown>) {
  return this.billing.upsertRule('billing_partner_rates', body, ['id', 'clientId', 'raisonSociale', 'category', 'discountBp', 'fixedDailyMillimes', 'active']);
 }
 @Delete('tarifs/partners/:id') delPartner(@Param('id') id: string) { return this.billing.removeRule('billing_partner_rates', id); }

 @Get('tarifs/penalties') penalties() { return this.billing.list('billing_penalties'); }
 @Put('tarifs/penalties') savePenalty(@Body() body: Record<string, unknown>) {
  return this.billing.upsertRule('billing_penalties', body, ['id', 'type', 'amountMillimes', 'percentBp', 'parameters', 'active']);
 }
 @Delete('tarifs/penalties/:id') delPenalty(@Param('id') id: string) { return this.billing.removeRule('billing_penalties', id); }

 @Post('quote') quote(@Body() body: unknown) { return this.billing.createQuote(body); }
 @Get('quotes') quotes() { return this.billing.list('billing_quotes'); }

 @Get('suggestions') suggestions() { return this.billing.suggestions(); }
 @Post('suggestions/:id/decision') decide(@Param('id') id: string, @Body() body: unknown, @Req() req: Request & { user: AuthUser }) {
  return this.billing.decideSuggestion(id, body, req.user.id);
 }

 @Get('invoices') invoices(@Query('reservationId') reservationId?: string) { return this.billing.listInvoices(reservationId); }
 @Put('invoices') saveInvoice(@Body() body: unknown, @Req() req: Request & { user: AuthUser }) { return this.billing.saveInvoice(body, req.user.id); }
 @Post('invoices/:id/issue') issue(@Param('id') id: string) { return this.billing.issueInvoice(id); }
 @Post('invoices/:id/payments') pay(@Param('id') id: string, @Body() body: unknown) { return this.billing.addPayment(id, body); }
 @Post('invoices/:id/credit-notes') credit(@Param('id') id: string, @Body() body: unknown) { return this.billing.creditNote(id, body); }
 @Post('invoices/from-quote/:quoteId') fromQuote(@Param('quoteId') quoteId: string, @Body() body: unknown, @Req() req: Request & { user: AuthUser }) {
  return this.billing.invoiceFromQuote(quoteId, body, req.user.id);
 }

 @Get('expenses') expenses() { return this.billing.list('billing_expenses'); }
 @Put('expenses') saveExpense(@Body() body: unknown) { return this.billing.saveExpense(body); }
 @Post('expenses/:id/status') expenseStatus(@Param('id') id: string, @Body() body: { status?: string }) {
  return this.billing.setExpenseStatus(id, String(body.status || ''));
 }

 @Get('sinistres') sinistres() { return this.billing.listSinistres(); }
 @Put('sinistres') saveSinistre(@Body() body: unknown) { return this.billing.saveSinistre(body); }

 @Get('obligations') obligations() { return this.billing.list('billing_obligations'); }
 @Put('obligations') saveObligation(@Body() body: unknown) { return this.billing.saveObligation(body); }
 @Get('fiscal/vat') vat(@Query('month') month: string) { return this.billing.fiscalVat(month); }
}
