import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { WorldsModule } from './worlds/worlds.module';
import { EntryTypesModule } from './entry-types/entry-types.module';
import { EntriesModule } from './entries/entries.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { StorageModule } from './storage/storage.module';
import { DatabaseModule } from './database/database.module';
import { NestingModule } from './nesting/nesting.module';
import { RelationshipsModule } from './relationships/relationships.module';

@Module({
  imports: [
    ConfigModule.forRoot({isGlobal: true, envFilePath: '../.env'}),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      exclude: ['/api/{*path}'],
    }),
    DatabaseModule,
    StorageModule,
    NestingModule,
    AuthModule,
    WorldsModule,
    EntryTypesModule,
    EntriesModule,
    RelationshipsModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [],
})

export class AppModule {}
