import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { CacheService } from './cache.service';

@Global()
@Module({
  imports: [
    // ✅ Built-in memory cache
    CacheModule.register({
      isGlobal: true,
      ttl: 300, // 5 minutes
      max: 1000, // limit number of cache items
    }),
  ],
  providers: [CacheService],
  exports: [CacheService, CacheModule],
})
export class GlobalCacheModule {}
