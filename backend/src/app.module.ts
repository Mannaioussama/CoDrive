import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './controllers/auth.controller';
import { AccountsController } from './controllers/accounts.controller';
import { PersonalController } from './controllers/personal.controller';
import { AuthService } from './services/auth.service';
import { AuthGuard } from './guards/auth.guard';
import { SettingsController } from './controllers/settings.controller';
import { SettingsService } from './services/settings.service';
import { SettingsSchema } from './models/settings.model';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AssignmentsController } from './controllers/assignments.controller';
import { HealthController } from './controllers/health.controller';
import { ResourcesController } from './controllers/resources.controller';
import { ResourcesService } from './services/resources.service';
import { modelDefinitions } from './models/resource.models';
@Module({
 imports: [
  ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../.env'] }),
  MongooseModule.forRootAsync({ inject: [ConfigService], useFactory: (config: ConfigService) => ({ uri: config.get<string>('MONGODB_URI') || 'mongodb://127.0.0.1:27018/fleetpro?replicaSet=fleetpro-rs', serverSelectionTimeoutMS: 5000, maxPoolSize: 10, retryAttempts: 1 }) }),
  MongooseModule.forFeature([...modelDefinitions, { name: 'WorkspaceSettings', schema: SettingsSchema, collection: 'workspace_settings' }]),
 ],
 controllers: [AuthController, AccountsController, PersonalController, SettingsController, ResourcesController, AssignmentsController, HealthController],
 providers: [AuthService, { provide: APP_GUARD, useClass: AuthGuard }, ResourcesService, SettingsService],
})
export class AppModule {}
