import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: '../.env' }), DatabaseModule],
  controllers: [AppController],
  providers: [],
})

export class AppModule {}
