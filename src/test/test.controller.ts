import { Controller, Get, Query } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';

@Controller('test')
export class TestController {
  constructor(private readonly cacheService: CacheService) {}

  @Get('set')
  async setCache() {
    await this.cacheService.set('greeting', { message: 'Hello Redis!' }, 300);
    return { status: 'Cache set successfully' };
  }

  @Get('get')
  async getCache() {
    const value = await this.cacheService.get('greeting');
    return { value };
  }

   @Get('cache-test')
  async testCache(@Query('key') key: string) {
    // store a value in cache
    await this.cacheService.set(key, { name: 'Owolabi', time: Date.now() });
    // retrieve it
    const value = await this.cacheService.get(key);
    return { value };
  }
}
