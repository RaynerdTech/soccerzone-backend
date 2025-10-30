// import { Injectable, Inject } from '@nestjs/common';
// import { CACHE_MANAGER } from '@nestjs/cache-manager';
// import type { Cache } from 'cache-manager';

// @Injectable()
// export class CacheService {
//   constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

//   async get<T>(key: string): Promise<T | null> {
//     const value = await this.cache.get<T>(key);
//     return value ?? null;
//   }

//   async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
//     await this.cache.set(key, value, ttlSeconds ?? 300); // TTL as number of seconds
//   }

//   async del(key: string): Promise<void> {
//     await this.cache.del(key);
//   }

//   async reset(): Promise<void> {
//     if (typeof (this.cache as any).reset === 'function') {
//       await (this.cache as any).reset();
//     }
//   }
// }


import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.cache.get<string>(key);
    if (!value) return null;

    try {
      return JSON.parse(value) as T; // parse JSON string
    } catch {
      return value as unknown as T; // fallback if not JSON
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const storeValue = typeof value === 'object' ? JSON.stringify(value) : value;
    await this.cache.set(key, storeValue, ttlSeconds ?? 300); // pass TTL as number
  }

  async del(key: string): Promise<void> {
    await this.cache.del(key);
  }

  async reset(): Promise<void> {
    if (typeof (this.cache as any).reset === 'function') {
      await (this.cache as any).reset();
    }
  }
}


