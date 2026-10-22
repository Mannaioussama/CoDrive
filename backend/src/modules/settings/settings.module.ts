import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { SettingsSchema } from './settings.model';

@Module({
 imports: [MongooseModule.forFeature([{ name: 'WorkspaceSettings', schema: SettingsSchema, collection: 'workspace_settings' }])],
 controllers: [SettingsController],
 providers: [SettingsService],
})
export class SettingsModule {}
