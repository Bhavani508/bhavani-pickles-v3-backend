import {
  Injectable,
  Logger,
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
import { ShiprocketService } from '../shipping/shiprocket.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
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
    private shiprocketService: ShiprocketService,
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

    // Already confirmed by webhook — just return the order
    if (order.isPaid) {
      return order.populate('items.product');
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
      const result = await this.variantModel.updateOne(
        {
          product: item.product._id ?? item.product,
          weight: item.weight,
          leftoverStock: { $gte: item.quantity },
        },
        { $inc: { leftoverStock: -item.quantity } },
      );
      if (result.modifiedCount === 0) {
        throw new BadRequestException(
          `Insufficient stock for ${item.weight} variant. Please try again.`,
        );
      }
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

  // ── Webhook: handle Razorpay payment.captured event ──────────────────────
  async handlePaymentCaptured(
    razorpayOrderId: string,
    razorpayPaymentId: string,
  ) {
    const order = await this.orderModel.findOne({ razorpayOrderId });
    if (!order) {
      // Order not found for this Razorpay order — ignore (could be a different system)
      return;
    }

    // Already processed (e.g. frontend verify-payment was faster)
    if (order.isPaid) return;

    order.isPaid = true;
    order.paidAt = new Date();
    order.status = OrderStatus.CONFIRMED;
    order.razorpayPaymentId = razorpayPaymentId;
    await order.save();

    await this.deductStock(order.items as any[]);
    await this.clearServerCart(order.user as Types.ObjectId);

    const user = await this.userModel.findById(order.user);
    if (user) {
      this.emailService.sendOrderConfirmation({
        customerName: user.name,
        customerEmail: user.email,
        orderId: (order._id as Types.ObjectId).toString(),
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
  }

  async findAll(query?: {
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, page = 1, limit = 20 } = query ?? {};
    const filter: any = {};
    if (status) filter.status = status;

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .populate('user', 'name email')
        .populate('items.product')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.orderModel.countDocuments(filter),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
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

  async getDashboardStats() {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [totals, daily, statusBreakdown] = await Promise.all([
      // Total revenue and count
      this.orderModel.aggregate([
        { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' }, totalOrders: { $sum: 1 } } },
      ]),
      // Daily orders and revenue for last 7 days
      this.orderModel.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            orders: { $sum: 1 },
            revenue: { $sum: '$totalAmount' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // Orders by status
      this.orderModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    // Fill in missing days
    const dailyMap = new Map(daily.map((d: any) => [d._id, d]));
    const dailyData: { date: string; orders: number; revenue: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(sevenDaysAgo.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const entry = dailyMap.get(key);
      dailyData.push({
        date: key,
        orders: entry?.orders ?? 0,
        revenue: entry?.revenue ?? 0,
      });
    }

    return {
      totalOrders: totals[0]?.totalOrders ?? 0,
      totalRevenue: totals[0]?.totalRevenue ?? 0,
      daily: dailyData,
      statusBreakdown: statusBreakdown.map((s: any) => ({
        status: s._id,
        count: s.count,
      })),
    };
  }

  // ── Shiprocket: Ship an order ─────────────────────────────────────────────

  async shipOrder(orderId: string) {
    const order = await this.orderModel
      .findById(orderId)
      .populate('user', 'name email phone')
      .exec();
    if (!order) throw new NotFoundException('Order not found');

    if (order.status === 'cancelled')
      throw new BadRequestException('Cannot ship a cancelled order');
    if (order.shiprocketOrderId)
      throw new BadRequestException('Order already submitted to Shiprocket');

    const user = order.user as any;
    const addr = order.shippingAddress;
    const createdAt = (order as any).createdAt as Date;

    // Create order on Shiprocket
    const srOrder = await this.shiprocketService.createOrder({
      orderId: orderId,
      orderDate: this.formatDate(createdAt),
      customerName: user?.name ?? 'Customer',
      customerEmail: user?.email ?? '',
      customerPhone: addr.phone ?? user?.phone ?? '',
      shippingAddress: addr.street,
      shippingCity: addr.city,
      shippingState: addr.state,
      shippingPincode: addr.pincode,
      shippingCountry: addr.country || 'India',
      items: (order.items as any[]).map((item) => ({
        name: item.name,
        sku: `${item.product?.toString()?.slice(-8) ?? 'PROD'}-${item.weight}`,
        units: item.quantity,
        sellingPrice: item.price,
      })),
      paymentMethod: order.paymentType === 'COD' ? 'COD' : 'Prepaid',
      subTotal: order.totalAmount,
      weight: 0.5, // default weight in kg
      length: 20,
      breadth: 15,
      height: 10,
    });

    this.logger.log(`Shiprocket createOrder response: ${JSON.stringify(srOrder)}`);

    order.shiprocketOrderId = srOrder.order_id;
    order.shiprocketShipmentId = srOrder.shipment_id;

    // Auto-assign courier
    try {
      const courierRes = await this.shiprocketService.assignCourier(srOrder.shipment_id);
      const courierData = courierRes.response?.data;
      if (courierData) {
        order.awbCode = courierData.awb_code;
        order.courierName = courierData.courier_name;
      }
    } catch (e) {
      // Courier assignment can fail if no courier is serviceable — save what we have
    }

    // Schedule pickup
    try {
      await this.shiprocketService.generatePickup(srOrder.shipment_id);
    } catch {
      // Non-fatal
    }

    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    // In non-production environments, cancel the Shiprocket order immediately
    if (!isProduction) {
      try {
        await this.shiprocketService.cancelOrder(srOrder.order_id);
      } catch {
        // Non-fatal — order may not be cancellable yet
      }

      order.status = OrderStatus.SHIPPED;
      await order.save();
      return {
        ...(await order.populate('items.product')).toObject(),
        _testMode: true,
        _message: 'Shiprocket order created and cancelled immediately (test mode)',
      };
    }

    // Update status to shipped if courier was assigned
    if (order.awbCode) {
      order.status = OrderStatus.SHIPPED;

      // Send email notification
      if (user?.email) {
        this.emailService.sendOrderStatusUpdate({
          customerName: user.name,
          customerEmail: user.email,
          orderId,
          status: 'shipped',
        });
      }
    }

    await order.save();
    return order.populate('items.product');
  }

  // ── Get live tracking from Shiprocket ─────────────────────────────────────

  async getShipmentTracking(orderId: string) {
    const order = await this.orderModel.findById(orderId).lean().exec();
    if (!order) throw new NotFoundException('Order not found');

    if (order.awbCode) {
      return this.shiprocketService.getTracking(order.awbCode);
    }
    if (order.shiprocketShipmentId) {
      return this.shiprocketService.getTrackingByShipment(order.shiprocketShipmentId);
    }

    throw new BadRequestException('No shipping info available for this order');
  }

  // ── Get shipping label ────────────────────────────────────────────────────

  async getShippingLabel(orderId: string) {
    const order = await this.orderModel.findById(orderId).lean().exec();
    if (!order) throw new NotFoundException('Order not found');
    if (!order.shiprocketShipmentId)
      throw new BadRequestException('Order not shipped via Shiprocket');

    const result = await this.shiprocketService.generateLabel(order.shiprocketShipmentId);
    return { labelUrl: result.label_url };
  }

  // ── Handle Shiprocket webhook status update ───────────────────────────────

  async handleShiprocketWebhook(payload: any) {
    const awb = payload.awb;
    const status = payload.current_status?.toLowerCase();
    if (!awb || !status) return;

    const order = await this.orderModel.findOne({ awbCode: awb });
    if (!order) return;

    // Map Shiprocket status to our status
    const statusMap: Record<string, OrderStatus> = {
      'picked up': OrderStatus.SHIPPED,
      'in transit': OrderStatus.SHIPPED,
      'out for delivery': OrderStatus.SHIPPED,
      delivered: OrderStatus.DELIVERED,
      rto: OrderStatus.CANCELLED,
    };

    const mapped = statusMap[status];
    if (!mapped || order.status === mapped) return;

    // Only allow forward progression (don't go backwards)
    const progression = [
      OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING,
      OrderStatus.SHIPPED, OrderStatus.DELIVERED,
    ];
    const currentIdx = progression.indexOf(order.status);
    const newIdx = progression.indexOf(mapped);
    if (newIdx <= currentIdx && mapped !== OrderStatus.CANCELLED) return;

    order.status = mapped;
    await order.save();

    const user = await this.userModel.findById(order.user);
    if (user) {
      this.emailService.sendOrderStatusUpdate({
        customerName: user.name,
        customerEmail: user.email,
        orderId: (order._id as Types.ObjectId).toString(),
        status: mapped,
      });
    }
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${min}`;
  }
}
