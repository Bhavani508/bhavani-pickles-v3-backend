import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import Razorpay from 'razorpay';
import { Order, OrderDocument, OrderStatus } from './schemas/order.schema';
import { Cart, CartDocument } from '../cart/schemas/cart.schema';
import {
  ProductVariant,
  ProductVariantDocument,
} from '../products/schemas/product-variant.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class OrdersService {
  private razorpay: Razorpay;

  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Cart.name) private cartModel: Model<CartDocument>,
    @InjectModel(ProductVariant.name)
    private variantModel: Model<ProductVariantDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {
    this.razorpay = new Razorpay({
      key_id: this.configService.get<string>('RAZORPAY_KEY_ID')!,
      key_secret: this.configService.get<string>('RAZORPAY_KEY_SECRET')!,
    });
  }

  // ── Resolve or create the user for this order ─────────────────────────────
  private async resolveUser(
    userId: string | null,
    dto: CreateOrderDto,
  ): Promise<UserDocument> {
    if (userId) {
      const user = await this.userModel.findById(userId);
      if (!user) throw new NotFoundException('User not found');
      return user;
    }

    // Guest: find existing account by email or create a new one
    const email = dto.customerEmail.toLowerCase().trim();
    let user = await this.userModel.findOne({ email });
    if (!user) {
      const plainPassword = crypto.randomBytes(10).toString('hex');
      const hashedPassword = await bcrypt.hash(plainPassword, 12);
      user = await new this.userModel({
        name: dto.customerName.trim(),
        email,
        phone: dto.customerPhone,
        password: hashedPassword,
      }).save();

      this.emailService.sendWelcome({
        name: user.name,
        email: user.email,
        password: plainPassword,
        isAutoCreated: true,
      });
    }
    return user;
  }

  // ── Step 1: Initiate — COD confirms directly, online creates Razorpay order ──
  async initiatePayment(userId: string | null, dto: CreateOrderDto) {
    const user = await this.resolveUser(userId, dto);
    const uid = user._id as Types.ObjectId;

    // Build order items — from server cart (logged-in) or DTO (guest)
    let orderItems: Array<{
      product: any;
      name: string;
      weight: string;
      quantity: number;
      price: number;
    }>;
    let totalAmount: number;

    if (userId) {
      const cart = await this.cartModel
        .findOne({ user: uid })
        .populate('items.product')
        .lean()
        .exec();
      if (!cart || cart.items.length === 0)
        throw new BadRequestException('Cart is empty');

      orderItems = cart.items.map((item) => {
        const product = item.product as any;
        return {
          product: product._id,
          name: product.name,
          weight: item.weight,
          quantity: item.quantity,
          price: item.price,
        };
      });
      totalAmount = cart.totalAmount;
    } else {
      if (!dto.guestItems?.length) throw new BadRequestException('Cart is empty');
      orderItems = dto.guestItems.map((item) => ({
        product: new Types.ObjectId(item.productId),
        name: item.name,
        weight: item.weight,
        quantity: item.quantity,
        price: item.price,
      }));
      totalAmount = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    }

    // ── COD: create confirmed order immediately ──────────────────────────────
    if (dto.paymentType === 'COD') {
      const order = await new this.orderModel({
        user: uid,
        items: orderItems,
        shippingAddress: dto.shippingAddress,
        totalAmount,
        notes: dto.notes,
        paymentType: 'COD',
        status: OrderStatus.CONFIRMED,
        isPaid: false,
      }).save();

      await this.deductStock(orderItems);
      if (userId) await this.clearServerCart(uid);

      this.emailService.sendOrderConfirmation({
        customerName: user.name,
        customerEmail: user.email,
        orderId: (order._id as Types.ObjectId).toString(),
        items: orderItems,
        totalAmount,
        shippingAddress: dto.shippingAddress,
        paymentType: 'COD',
      });

      return { orderId: order._id, paymentType: 'COD' };
    }

    // ── Online: create Razorpay order + pending DB order ────────────────────
    const razorpayOrder = await this.razorpay.orders.create({
      amount: Math.round(totalAmount * 100),
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
    });

    const order = await new this.orderModel({
      user: uid,
      items: orderItems,
      shippingAddress: dto.shippingAddress,
      totalAmount,
      notes: dto.notes,
      paymentType: 'online',
      status: OrderStatus.PENDING,
      isPaid: false,
      razorpayOrderId: razorpayOrder.id,
    }).save();

    return {
      orderId: order._id,
      paymentType: 'online',
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
    };
  }

  // ── Step 2: Verify payment signature, mark order paid ───────────────────────
  async verifyPayment(orderId: string, dto: VerifyPaymentDto) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    const body = dto.razorpayOrderId + '|' + dto.razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac(
        'sha256',
        this.configService.get<string>('RAZORPAY_KEY_SECRET')!,
      )
      .update(body)
      .digest('hex');

    if (expectedSignature !== dto.razorpaySignature) {
      throw new BadRequestException('Invalid payment signature');
    }

    order.isPaid = true;
    order.paidAt = new Date();
    order.status = OrderStatus.CONFIRMED;
    order.razorpayPaymentId = dto.razorpayPaymentId;
    await order.save();

    await this.deductStock(order.items as any[]);
    await this.clearServerCart(order.user as Types.ObjectId);

    const user = await this.userModel.findById(order.user);
    if (user) {
      this.emailService.sendOrderConfirmation({
        customerName: user.name,
        customerEmail: user.email,
        orderId: orderId,
        items: (order.items as any[]).map((i) => ({
          name: i.name,
          weight: i.weight,
          quantity: i.quantity,
          price: i.price,
        })),
        totalAmount: order.totalAmount,
        shippingAddress: order.shippingAddress,
        paymentType: 'online',
      });
    }

    return order.populate('items.product');
  }

  // ── Deduct variant stock ──────────────────────────────────────────────────
  private async deductStock(
    items: Array<{ product: any; weight: string; quantity: number }>,
  ) {
    const affectedProductIds = new Set<string>();
    for (const item of items) {
      const productId = item.product._id?.toString() ?? item.product.toString();
      await this.variantModel.updateOne(
        { product: item.product._id ?? item.product, weight: item.weight },
        { $inc: { leftoverStock: -item.quantity } },
      );
      affectedProductIds.add(productId);
    }

    for (const productId of affectedProductIds) {
      const allVariants = await this.variantModel.find({
        product: new Types.ObjectId(productId),
      });
      const allDepleted =
        allVariants.length > 0 && allVariants.every((v) => v.leftoverStock <= 0);
      if (allDepleted) {
        await this.productModel.findByIdAndUpdate(productId, { isOutOfStock: true });
      }
    }
  }

  // ── Clear server-side cart for a user (no-op if cart doesn't exist) ────────
  private async clearServerCart(userId: Types.ObjectId) {
    await this.cartModel.findOneAndUpdate(
      { user: userId },
      { items: [], totalAmount: 0 },
    );
  }

  // ── Cancel an order ────────────────────────────────────────────────────
  private static CANCELLABLE_STATUSES = [
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
    OrderStatus.PROCESSING,
  ];

  async cancelOrder(
    orderId: string,
    userId: string | null,
    role: string,
    dto: CancelOrderDto,
  ) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    // Users can only cancel their own orders
    if (role !== 'admin' && order.user.toString() !== userId) {
      throw new BadRequestException('You can only cancel your own orders');
    }

    if (!OrdersService.CANCELLABLE_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        `Order cannot be cancelled — current status is "${order.status}". Only orders that are pending, confirmed, or processing can be cancelled.`,
      );
    }

    // Restore stock for the cancelled items
    await this.restoreStock(order.items as any[]);

    order.status = OrderStatus.CANCELLED;
    order.cancellationReason = dto.reason;
    order.cancelledAt = new Date();
    order.cancelledBy = role === 'admin' ? 'admin' : 'user';
    await order.save();

    const user = await this.userModel.findById(order.user);
    if (user) {
      this.emailService.sendOrderCancelled({
        customerName: user.name,
        customerEmail: user.email,
        orderId: orderId,
        items: (order.items as any[]).map((i) => ({
          name: i.name,
          weight: i.weight,
          quantity: i.quantity,
          price: i.price,
        })),
        totalAmount: order.totalAmount,
        reason: dto.reason,
        cancelledBy: order.cancelledBy!,
      });
    }

    return order.populate('items.product');
  }

  // ── Restore variant stock on cancellation ─────────────────────────────
  private async restoreStock(
    items: Array<{ product: any; weight: string; quantity: number }>,
  ) {
    const affectedProductIds = new Set<string>();
    for (const item of items) {
      const productId = item.product._id?.toString() ?? item.product.toString();
      await this.variantModel.updateOne(
        { product: item.product._id ?? item.product, weight: item.weight },
        { $inc: { leftoverStock: item.quantity } },
      );
      affectedProductIds.add(productId);
    }

    // If product was marked out-of-stock, clear the flag since stock is restored
    for (const productId of affectedProductIds) {
      const hasStock = await this.variantModel.exists({
        product: new Types.ObjectId(productId),
        leftoverStock: { $gt: 0 },
      });
      if (hasStock) {
        await this.productModel.findByIdAndUpdate(productId, {
          isOutOfStock: false,
        });
      }
    }
  }

  findAll() {
    return this.orderModel
      .find()
      .populate('user', 'name email')
      .populate('items.product')
      .sort({ createdAt: -1 })
      .exec();
  }

  findByUser(userId: string) {
    return this.orderModel
      .find({ user: new Types.ObjectId(userId) })
      .populate('items.product')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string) {
    const order = await this.orderModel
      .findById(id)
      .populate('user', 'name email')
      .populate('items.product')
      .exec();
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    const order = await this.orderModel.findByIdAndUpdate(
      id,
      { status: dto.status },
      { new: true },
    );
    if (!order) throw new NotFoundException('Order not found');

    const user = await this.userModel.findById(order.user);
    if (user) {
      this.emailService.sendOrderStatusUpdate({
        customerName: user.name,
        customerEmail: user.email,
        orderId: id,
        status: dto.status,
      });
    }

    return order;
  }
}
