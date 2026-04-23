process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // TODO: remove in production
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: '*' });
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT || 3000);
  console.log('Server running on port ' + (process.env.PORT || 3000));
}
bootstrap();
