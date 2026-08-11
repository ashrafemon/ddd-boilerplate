import { ConfigService } from '@config/config.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MemcachedService {
  constructor(private readonly configService: ConfigService) {}

  createMemcacheOptions() {
    const config = this.configService.getMemcached();

    return {
      connections: [{ host: config.host, port: config.port }],
      ttl: Number(config.ttl ?? 0),
    };
  }
}
