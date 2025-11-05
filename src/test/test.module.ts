// import { Module } from '@nestjs/common';
// import { TestController } from './test.controller';
// import { GlobalCacheModule } from '../cache/cache.module';
// import { CacheService } from '../cache/cache.service';

// @Module({
//   imports: [GlobalCacheModule],
//   controllers: [TestController],
//   providers: [CacheService],
// })
// export class TestModule {}

import { Module } from '@nestjs/common';
import { TestController } from './test.controller';
import { CacheService } from '../cache/cache.service';

@Module({
  controllers: [TestController],
  providers: [CacheService],
})
export class TestModule {}
