import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { OrdersService } from './orders.service';
import { InvoiceService } from './invoice.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly invoiceService: InvoiceService,
  ) {}

  // Works for both guests and logged-in users
  @Post('initiate')
  @UseGuards(OptionalJwtAuthGuard)
  initiatePayment(
    @CurrentUser('sub') userId: string | null,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.initiatePayment(userId ?? null, dto);
  }

  // No auth required — just verifies by orderId
  @Post(':id/verify-payment')
  verifyPayment(@Param('id') id: string, @Body() dto: VerifyPaymentDto) {
    return this.ordersService.verifyPayment(id, dto);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  getMyOrders(@CurrentUser('sub') userId: string) {
    return this.ordersService.findByUser(userId);
  }

  @Get('dashboard-stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getDashboardStats() {
    return this.ordersService.getDashboardStats();
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  findAll(
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.ordersService.findAll({ status, page, limit });
  }

  @Get('shipping-rates')
  async getShippingRates(
    @Query('pincode') pincode: string,
    @Query('weight') weight?: string,
    @Query('cod') cod?: string,
  ) {
    return this.ordersService.getShippingRates(pincode, Number(weight) || 0.5, cod === 'true');
  }

  @Get('track')
  async trackGuestOrder(
    @Query('orderId') orderId: string,
    @Query('email') email: string,
  ) {
    return this.ordersService.trackGuestOrder(orderId, email);
  }

  @Get(':id/invoice')
  @UseGuards(JwtAuthGuard)
  async downloadInvoice(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: string,
    @Res() res: Response,
  ) {
    const order = await this.ordersService.findOne(id);
    const orderUserId = (order.user as any)?._id?.toString() ?? order.user?.toString();
    if (role !== 'admin' && orderUserId !== userId) {
      res.status(403).json({ message: 'You can only download your own invoices' });
      return;
    }
    const user = order.user as any;
    const shortId = id.slice(-8).toUpperCase();

    const doc = this.invoiceService.generateInvoice(
      order,
      user?.name ?? 'Customer',
      user?.email ?? '',
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=invoice-${shortId}.pdf`,
    });

    doc.pipe(res);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: string,
  ) {
    const order = await this.ordersService.findOne(id);
    const orderUserId = (order.user as any)?._id?.toString() ?? order.user?.toString();
    if (role !== 'admin' && orderUserId !== userId) {
      throw new ForbiddenException('You can only view your own orders');
    }
    return order;
  }

  // Both users (own orders) and admins can cancel
  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard)
  cancelOrder(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.ordersService.cancelOrder(id, userId, role, dto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(id, dto);
  }

  @Get(':id/tracking')
  @UseGuards(JwtAuthGuard)
  getTracking(@Param('id') id: string) {
    return this.ordersService.getShipmentTracking(id);
  }

  @Get(':id/label')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getLabel(@Param('id') id: string) {
    return this.ordersService.getShippingLabel(id);
  }
}
