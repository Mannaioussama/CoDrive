import 'reflect-metadata';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

// Cache the Nest app (and thus the Mongoose connection) across warm Vercel invocations.
// VERIFY: NestJS on Vercel (Fluid compute) reuses the process; module scope keeps one instance.
let appPromise: Promise<NestExpressApplication> | null = null;

async function createApp(): Promise<NestExpressApplication> {
 const app = await NestFactory.create<NestExpressApplication>(AppModule);
 const config = app.get(ConfigService);
 // VERIFY: trust proxy 1 is correct for a single Vercel reverse-proxy hop so req.ip is the client.
 app.set('trust proxy', 1);
 app.setGlobalPrefix('api');
 app.useBodyParser('json', { limit: '512kb' });
 app.enableCors({ origin: (config.get<string>('CORS_ORIGINS') || 'http://localhost:3017,http://127.0.0.1:3017,http://localhost:3000,http://127.0.0.1:3000').split(',').map(s => s.trim()), methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] });
 app.use((_req: unknown, res: { setHeader: (key: string, value: string) => void }, next: () => void) => { res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
 const docs = new DocumentBuilder().setTitle('coDrive — API Ressources').setDescription('API locale NestJS / MongoDB. CRUD des cinq collections. Les mutations retournent un instantané complet. Les champs inconnus sont refusés.').setVersion('1.0').build();
 SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, docs));
 app.enableShutdownHooks();
 return app;
}

async function bootstrap() {
 if (!appPromise) appPromise = createApp();
 const app = await appPromise;
 const config = app.get(ConfigService);
 // VERIFY: official NestJS-on-Vercel entry keeps app.listen(); Vercel wraps it as one Function.
 await app.listen(Number(config.get('PORT') || 4000), config.get<string>('HOST') || '127.0.0.1');
}
void bootstrap();
