import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { CacheService } from './cache.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    ConfigModule,
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        store: redisStore,
        socket: {
          host: configService.get<string>('REDIS_HOST') || '127.0.0.1',
          port: parseInt(configService.get<string>('REDIS_PORT') || '6379'),
        },
        ttl: 300, // default TTL 5 minutes
      }),
    }),
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class GlobalCacheModule {}
