import { ConfigService } from '@config/config.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SqsService {
  constructor(private readonly configService: ConfigService) {}

  createSqsOptions() {
    const config = this.configService.getSqs();
    return {
      consumers: [{ name: 'consumer1', queueUrl: config.url, region: config.region }],
      producers: [{ name: 'producer1', queueUrl: config.url, region: config.region }],
    };
  }
}
