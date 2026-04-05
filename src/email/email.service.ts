import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { orderConfirmationTemplate } from './templates/order-confirmation';
import { orderCancelledTemplate } from './templates/order-cancelled';
import { orderStatusUpdateTemplate } from './templates/order-status-update';
import { welcomeTemplate } from './templates/welcome';
import { resetPasswordTemplate } from './templates/reset-password';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
  private resend: Resend;
  private fromEmail: string;
  private readonly logger = new Logger(EmailService.name);

  constructor(private configService: ConfigService) {
    const resendAPIKey = this.configService.get<string>('RESEND_API_KEY');
    if (!resendAPIKey) {
      this.logger.error('RESEND_API_KEY is not set in environment variables');
      throw new Error('Email service initialization failed');
    }
    this.resend = new Resend(resendAPIKey);
    this.fromEmail = this.configService.get<string>(
      'FROM_EMAIL',
      'no-reply@bhavanipickles.com',
    );
  }

  async sendEmail(options: SendEmailOptions) {
    if (this.configService.get<string>('ENABLE_EMAILS', 'false') !== 'true') {
      this.logger.log('Emails disabled — skipping send');
      return null;
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: `Bhavani Pickles <${this.fromEmail}>`,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
      });

      if (error) {
        this.logger.error(`Failed to send email: ${error.message}`);
        return null;
      }

      this.logger.log(`Email sent successfully: ${data?.id}`);
      return data;
    } catch (err) {
      this.logger.error(`Email send error: ${err}`);
      return null;
    }
  }

  // ── Template-based email methods ───────────────────────────────────────────

  async sendOrderConfirmation(order: {
    customerName: string;
    customerEmail: string;
    orderId: string;
    items: Array<{
      name: string;
      weight: string;
      quantity: number;
      price: number;
    }>;
    totalAmount: number;
    shippingAddress: {
      street: string;
      city: string;
      state: string;
      pincode: string;
    };
    paymentType: string;
  }) {
    return this.sendEmail({
      to: order.customerEmail,
      subject: `Order Confirmed - #${order.orderId}`,
      html: orderConfirmationTemplate(order),
    });
  }

  async sendOrderCancelled(order: {
    customerName: string;
    customerEmail: string;
    orderId: string;
    items: Array<{
      name: string;
      weight: string;
      quantity: number;
      price: number;
    }>;
    totalAmount: number;
    reason?: string;
    cancelledBy: string;
  }) {
    return this.sendEmail({
      to: order.customerEmail,
      subject: `Order Cancelled - #${order.orderId}`,
      html: orderCancelledTemplate(order),
    });
  }

  async sendOrderStatusUpdate(order: {
    customerName: string;
    customerEmail: string;
    orderId: string;
    status: string;
  }) {
    return this.sendEmail({
      to: order.customerEmail,
      subject: `Order Update - #${order.orderId}`,
      html: orderStatusUpdateTemplate(order),
    });
  }

  async sendWelcome(user: {
    name: string;
    email: string;
    password?: string;
    isAutoCreated?: boolean;
  }) {
    return this.sendEmail({
      to: user.email,
      subject: 'Welcome to Bhavani Pickles!',
      html: welcomeTemplate(user),
    });
  }

  async sendPasswordReset(data: { name: string; email: string; resetUrl: string }) {
    return this.sendEmail({
      to: data.email,
      subject: 'Reset Your Password – Bhavani Pickles',
      html: resetPasswordTemplate({ name: data.name, resetUrl: data.resetUrl }),
    });
  }
}
