import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { attachDatabasePool } from '@vercel/functions';
import type { Connection } from 'mongoose';
import { AuthModule } from './modules/auth/auth.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ResourcesModule } from './modules/resources/resources.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { ComplaintsModule } from './modules/complaints/complaints.module';
import { BillingModule } from './modules/billing/billing.module';

@Module({
 imports: [
  ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../.env'] }),
  MongooseModule.forRootAsync({
   inject: [ConfigService],
   useFactory: (config: ConfigService) => ({
    uri: config.get<string>('MONGODB_URI') || 'mongodb://127.0.0.1:27018/fleetpro?replicaSet=fleetpro-rs',
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
    maxIdleTimeMS: 5000,
    retryAttempts: 1,
    connectionFactory: (connection: Connection) => {
     const client = connection.getClient?.();
     if (client) attachDatabasePool(client);
     return connection;
    },
   }),
  }),
  AuthModule,
  SettingsModule,
  ResourcesModule,
  VehiclesModule,
  ReservationsModule,
  ComplaintsModule,
  BillingModule,
 ],
})
export class AppModule {}
