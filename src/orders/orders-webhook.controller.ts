import {
  Controller,
  Post,
  Headers,
  RawBody,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiExcludeEndpoint } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import * as crypto from 'crypto';
import { OrdersService } from './orders.service';

@ApiTags('webhooks')
@SkipThrottle()
@Controller('webhooks')
export class OrdersWebhookController {
  private readonly logger = new Logger(OrdersWebhookController.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly configService: ConfigService,
  ) {}

  @Post('razorpay')
  @ApiExcludeEndpoint()
  async handleRazorpayWebhook(
    @Headers('x-razorpay-signature') signature: string,
    @RawBody() rawBody: Buffer,
  ) {
    const secret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!secret) {
      const env = this.configService.get<string>('NODE_ENV');
      if (env === 'production') {
        this.logger.error('RAZORPAY_WEBHOOK_SECRET not configured in production — rejecting');
        throw new BadRequestException('Webhook not configured');
      }
      this.logger.warn('RAZORPAY_WEBHOOK_SECRET not configured — skipping webhook');
      return { status: 'ignored' };
    }

    if (!signature || !rawBody) {
      throw new BadRequestException('Missing signature or body');
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      this.logger.warn('Invalid Razorpay webhook signature');
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = JSON.parse(rawBody.toString());
    this.logger.log(`Razorpay webhook received: ${event.event}`);

    if (event.event === 'payment.captured') {
      const payment = event.payload?.payment?.entity;
      if (!payment) {
        this.logger.warn('Webhook payment.captured missing payment entity');
        return { status: 'ignored' };
      }

      await this.ordersService.handlePaymentCaptured(
        payment.order_id,
        payment.id,
      );
    }

    // Always return 200 to Razorpay (even for events we don't handle)
    return { status: 'ok' };
  }
}
