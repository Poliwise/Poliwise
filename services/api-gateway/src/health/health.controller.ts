import { Controller, Get } from '@nestjs/common';
import { ServicesIndicator } from './indicators/services.indicator';
import { ApiResponse } from '../common/dto';
import { Public } from '../common/decorators';

@Controller('health')
export class HealthController {
  constructor(private readonly servicesIndicator: ServicesIndicator) {}

  @Get()
  @Public()
  async check() {
    return ApiResponse.success({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'api-gateway',
    });
  }

  @Get('live')
  @Public()
  async live() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @Public()
  async ready() {
    const services = await this.servicesIndicator.checkAllServices();
    const allUp = services.every((s) => s.status === 'up');

    return ApiResponse.success({
      status: allUp ? 'ready' : 'degraded',
      timestamp: new Date().toISOString(),
      services,
    });
  }

  @Get('circuit-breakers')
  @Public()
  async circuitBreakers() {
    return ApiResponse.success({
      timestamp: new Date().toISOString(),
    });
  }
}
