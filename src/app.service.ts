import { Injectable } from '@nestjs/common';
// import { CacheService } from './cache/cache.service';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}
