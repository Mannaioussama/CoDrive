import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { DEFAULT_WORKSPACE } from '../../../../lib/workspace';
import { SettingsService } from './settings.service';
@ApiTags('Personnalisation')
@Controller('settings')
export class SettingsController {
 constructor(private readonly settings: SettingsService) {}
 @Get() get() { return this.settings.get(); }
 @Put() @ApiBody({ schema: { type: 'object', required: Object.keys(DEFAULT_WORKSPACE), properties: { agencyName: { type: 'string', maxLength: 100 }, logoDataUrl: { type: 'string', description: 'Image PNG, JPEG ou WebP encodée en data URL, ou chaîne vide.' }, theme: { type: 'string', enum: ['light', 'dark', 'system'] }, primaryColor: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' }, accentColor: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' }, dashboardType: { type: 'string', enum: ['operational', 'analytical', 'intelligent'] } } } })
 save(@Body() body: unknown) { return this.settings.save(body); }
}
