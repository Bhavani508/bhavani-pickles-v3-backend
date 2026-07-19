import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart, CartDocument } from './schemas/cart.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { ProductVariant, ProductVariantDocument } from '../products/schemas/product-variant.schema';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name) private cartModel: Model<CartDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(ProductVariant.name) private variantModel: Model<ProductVariantDocument>,
  ) {}

  async getCart(userId: string) {
    const uid = new Types.ObjectId(userId);
    let cart = await this.cartModel.findOne({ user: uid }).populate('items.product').exec();
    if (!cart) {
      cart = await new this.cartModel({ user: uid, items: [], totalAmount: 0 }).save();
    }
    return cart;
  }

  async addItem(userId: string, dto: AddToCartDto) {
    const product = await this.productModel.findById(dto.productId);
    if (!product || !product.isActive) throw new NotFoundException('Product not found');

    const variant = await this.variantModel.findOne({
      product: new Types.ObjectId(dto.productId),
      weight: dto.weight,
    });
    if (!variant) throw new NotFoundException('Variant not found');
    if (variant.leftoverStock < dto.quantity) throw new BadRequestException('Insufficient stock');

    const uid = new Types.ObjectId(userId);
    let cart = await this.cartModel.findOne({ user: uid });
    if (!cart) cart = new this.cartModel({ user: uid, items: [], totalAmount: 0 });

    const itemPrice = variant.discountedPrice ?? variant.price;
    const existingItem = cart.items.find(
      (i) => i.product.toString() === dto.productId && i.weight === dto.weight,
    );

    if (existingItem) {
      const newTotal = existingItem.quantity + dto.quantity;
      if (newTotal > variant.leftoverStock) {
        throw new BadRequestException(
          `Only ${variant.leftoverStock} units available. You already have ${existingItem.quantity} in your cart.`,
        );
      }
      existingItem.quantity = newTotal;
    } else {
      (cart.items as any[]).push({
        product: product._id,
        variantId: variant._id,
        weight: variant.weight,
        quantity: dto.quantity,
        price: itemPrice,
      });
    }

    cart.totalAmount = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    await cart.save();
    return cart.populate('items.product');
  }

  async updateItem(userId: string, productId: string, weight: string, dto: UpdateCartItemDto) {
    const cart = await this.cartModel.findOne({ user: new Types.ObjectId(userId) });
    if (!cart) throw new NotFoundException('Cart not found');

    const item = cart.items.find(
      (i) => i.product.toString() === productId && i.weight === weight,
    );
    if (!item) throw new NotFoundException('Item not in cart');

    const variant = await this.variantModel.findOne({
      product: new Types.ObjectId(productId),
      weight,
    });
    if (!variant) throw new NotFoundException('Variant not found');

    if (dto.quantity > variant.leftoverStock) {
      throw new BadRequestException(`Only ${variant.leftoverStock} units available in stock.`);
    }

    item.quantity = dto.quantity;
    cart.totalAmount = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    await cart.save();
    return cart.populate('items.product');
  }

  async removeItem(userId: string, productId: string, weight: string) {
    const cart = await this.cartModel.findOne({ user: new Types.ObjectId(userId) });
    if (!cart) throw new NotFoundException('Cart not found');

    cart.items = cart.items.filter(
      (i) => !(i.product.toString() === productId && i.weight === weight),
    );
    cart.totalAmount = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    await cart.save();
    return cart.populate('items.product');
  }

  async clearCart(userId: string) {
    await this.cartModel.findOneAndUpdate({ user: new Types.ObjectId(userId) }, { items: [], totalAmount: 0 });
  }
}
