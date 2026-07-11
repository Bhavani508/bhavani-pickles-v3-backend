import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersService } from './orders.service';
import { InvoiceService } from './invoice.service';
import { OrdersController } from './orders.controller';
import { OrdersWebhookController } from './orders-webhook.controller';
import { ShippingWebhookController } from './shipping-webhook.controller';
import { Order, OrderSchema } from './schemas/order.schema';
import { Cart, CartSchema } from '../cart/schemas/cart.schema';
import { ProductVariant, ProductVariantSchema } from '../products/schemas/product-variant.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { EmailModule } from '../email/email.module';
import { ShippingModule } from '../shipping/shipping.module';

@Module({
  imports: [
    ConfigModule,
    EmailModule,
    ShippingModule,
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Cart.name, schema: CartSchema },
      { name: ProductVariant.name, schema: ProductVariantSchema },
      { name: Product.name, schema: ProductSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [OrdersController, OrdersWebhookController, ShippingWebhookController],
  providers: [OrdersService, InvoiceService],
})
export class OrdersModule {}
