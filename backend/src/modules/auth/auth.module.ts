import { Module, forwardRef } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AccountsController } from './accounts.controller';
import { PersonalController } from './personal.controller';
import { HealthController } from './health.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { ResourcesModule } from '../resources/resources.module';

@Module({
 imports: [forwardRef(() => ResourcesModule)],
 controllers: [AuthController, AccountsController, PersonalController, HealthController],
 providers: [AuthService, { provide: APP_GUARD, useClass: AuthGuard }],
 exports: [AuthService],
})
export class AuthModule {}
