import { Controller, Post, Body, Headers, HttpCode, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';

@ApiTags('webhooks')
@Controller('webhook/shiprocket')
export class ShippingWebhookController {
  private readonly logger = new Logger(ShippingWebhookController.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Body() payload: any,
    @Headers('x-api-key') apiKey?: string,
  ) {
    const expectedToken = this.config.get<string>('SHIPROCKET_WEBHOOK_TOKEN');

    if (expectedToken && apiKey !== expectedToken) {
      this.logger.warn('Shiprocket webhook: invalid token');
      return { status: 'ignored' };
    }

    this.logger.log(`Shiprocket webhook received: AWB=${payload.awb}, status=${payload.current_status}`);

    try {
      await this.ordersService.handleShiprocketWebhook(payload);
    } catch (e) {
      this.logger.error('Shiprocket webhook processing error', e);
    }

    return { status: 'ok' };
  }
}
