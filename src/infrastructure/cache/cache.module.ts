import { MemcachedModule } from '@andreafspeziale/nestjs-memcached';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MemcachedService } from './memcached/memcached.service';
import { RedisService } from './redis/redis.service';

@Global()
@Module({
  imports: [
    MemcachedModule.forRootAsync({
      imports: [ConfigModule],
      inject: [MemcachedService],
      useFactory: (service: MemcachedService) => {
        return service.createMemcacheOptions();
      },
    }),
  ],
  providers: [RedisService, MemcachedService],
})
export class CacheModule {}
