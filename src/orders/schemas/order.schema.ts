import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Product } from '../../products/schemas/product.schema';

export type OrderDocument = HydratedDocument<Order>;

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

@Schema()
export class OrderItem {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true })
  product!: Product;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  weight!: string;

  @Prop({ required: true, min: 1 })
  quantity!: number;

  @Prop({ required: true, min: 0 })
  price!: number;
}

const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

@Schema()
export class ShippingAddress {
  @Prop({ required: true }) street!: string;
  @Prop({ required: true }) city!: string;
  @Prop({ required: true }) state!: string;
  @Prop({ required: true }) pincode!: string;
  @Prop({ required: true, default: 'IN' }) country!: string;
  @Prop() phone?: string;
}

const ShippingAddressSchema = SchemaFactory.createForClass(ShippingAddress);

@Schema({ timestamps: true })
export class Order {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user!: Types.ObjectId;

  @Prop({ type: [OrderItemSchema], required: true })
  items!: OrderItem[];

  @Prop({ type: ShippingAddressSchema, required: true })
  shippingAddress!: ShippingAddress;

  @Prop({ required: true, min: 0 })
  totalAmount!: number;

  @Prop({ enum: OrderStatus, default: OrderStatus.PENDING })
  status!: OrderStatus;

  @Prop()
  notes?: string;

  @Prop({ enum: ['COD', 'online'], default: 'online' })
  paymentType!: 'COD' | 'online';

  @Prop({ default: false })
  isPaid!: boolean;

  @Prop()
  paidAt?: Date;

  @Prop()
  razorpayOrderId?: string;

  @Prop()
  razorpayPaymentId?: string;

  @Prop()
  cancellationReason?: string;

  @Prop()
  cancelledAt?: Date;

  @Prop()
  cancelledBy?: string; // 'user' or 'admin'

  // Shiprocket shipping fields
  @Prop()
  shiprocketOrderId?: number;

  @Prop()
  shiprocketShipmentId?: number;

  @Prop()
  awbCode?: string;

  @Prop()
  courierName?: string;

  @Prop()
  trackingUrl?: string;

  @Prop()
  shippingLabelUrl?: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
