import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ServicesIndicator } from './indicators/services.indicator';
import { ProxyModule } from '../proxy/proxy.module';

@Module({
  imports: [ProxyModule],
  controllers: [HealthController],
  providers: [ServicesIndicator],
})
export class HealthModule {}
