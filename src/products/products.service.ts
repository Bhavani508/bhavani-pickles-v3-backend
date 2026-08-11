import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import {
  ProductVariant,
  ProductVariantDocument,
} from './schemas/product-variant.schema';
import { Category, CategoryDocument } from '../categories/schemas/category.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

export interface ProductQuery {
  category?: string;
  search?: string;
  tag?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string; // 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc' | 'newest'
  page?: number;
  limit?: number;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(ProductVariant.name)
    private variantModel: Model<ProductVariantDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
  ) {}

  async create(dto: CreateProductDto) {
    const { variants: variantDtos, ...productData } = dto;

    // Create product first with empty variants
    const product = await new this.productModel({
      ...productData,
      variants: [],
    }).save();

    // Create each variant as a separate document linked to the product
    const variants = await Promise.all(
      variantDtos.map((v) =>
        new this.variantModel({
          ...v,
          leftoverStock: v.stock,
          product: product._id,
        }).save(),
      ),
    );

    // Link variant IDs back to the product
    product.variants = variants.map((v) => v._id) as any;
    await product.save();

    return product.populate(['category', 'variants']);
  }

  async findAll(query: ProductQuery) {
    const {
      category,
      search,
      tag,
      minPrice,
      maxPrice,
      sort,
      page = 1,
      limit = 12,
    } = query;

    const filter: any = { isActive: true };

    if (category) filter.category = category;
    if (tag) filter.tags = tag;
    if (search) {
      const regex = new RegExp(search, 'i');
      const matchingCategories = await this.categoryModel
        .find({ name: regex })
        .select('_id')
        .lean();
      const categoryIds = matchingCategories.map((c) => c._id);
      filter.$or = [{ name: regex }, { category: { $in: categoryIds } }];
    }

    // Price filter: query variants first to get matching product IDs
    if (minPrice !== undefined || maxPrice !== undefined) {
      const priceFilter: any = {};
      if (minPrice !== undefined) priceFilter.$gte = Number(minPrice);
      if (maxPrice !== undefined) priceFilter.$lte = Number(maxPrice);
      const matchingProductIds = await this.variantModel
        .find({ price: priceFilter })
        .distinct('product');
      filter._id = { $in: matchingProductIds };
    }

    // Sort options
    const sortMap: Record<string, Record<string, 1 | -1>> = {
      name_asc: { name: 1 },
      name_desc: { name: -1 },
      newest: { createdAt: -1 },
    };
    const sortOrder: any = sort ? (sortMap[sort] ?? { createdAt: -1 }) : { createdAt: -1 };

    const skip = (page - 1) * limit;
    let query_ = this.productModel
      .find(filter)
      .populate('category')
      .populate('variants')
      .sort(sortOrder)
      .skip(skip)
      .limit(limit)
      .lean();

    const [items, total] = await Promise.all([
      query_.exec(),
      this.productModel.countDocuments(filter),
    ]);

    // Post-query sort for price (needs variant data)
    if (sort === 'price_asc' || sort === 'price_desc') {
      items.sort((a: any, b: any) => {
        const priceA = a.variants?.[0]?.price ?? 0;
        const priceB = b.variants?.[0]?.price ?? 0;
        return sort === 'price_asc' ? priceA - priceB : priceB - priceA;
      });
    }

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const product = await this.productModel
      .findById(id)
      .populate('category')
      .populate('variants')
      .lean()
      .exec();
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    const { variants: variantDtos, ...productData } = dto;

    // If variants are provided, replace them
    if (variantDtos && variantDtos.length > 0) {
      // Delete old variants
      await this.variantModel.deleteMany({ product: new Types.ObjectId(id) });

      // Create new variants
      const variants = await Promise.all(
        variantDtos.map((v) =>
          new this.variantModel({
            ...v,
            leftoverStock: v.stock,
            product: new Types.ObjectId(id),
          }).save(),
        ),
      );

      (productData as any).variants = variants.map((v) => v._id);

      // If any variant has stock > 0, clear the out-of-stock flag
      const hasStock = variantDtos.some((v) => v.stock > 0);
      if (hasStock) (productData as any).isOutOfStock = false;
    }

    const product = await this.productModel
      .findByIdAndUpdate(id, productData, { new: true })
      .populate('category')
      .populate('variants');
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async remove(id: string) {
    await Promise.all([
      this.productModel.findByIdAndUpdate(id, { isActive: false }),
      this.variantModel.updateMany(
        { product: new Types.ObjectId(id) },
        { stock: 0 },
      ),
    ]);
  }

  async getDistinctTags(): Promise<string[]> {
    return this.productModel.distinct('tags', { isActive: true }).exec();
  }

  async toggleBestSeller(id: string) {
    const product = await this.productModel.findById(id);
    if (!product) throw new NotFoundException('Product not found');
    product.isBestSeller = !product.isBestSeller;
    await product.save();
    return product.populate(['category', 'variants']);
  }

  async getBestSellers() {
    // Check for admin-marked best sellers
    const marked = await this.productModel
      .find({ isBestSeller: true, isActive: true })
      .populate('category')
      .populate('variants')
      .lean()
      .exec();

    if (marked.length > 0) return marked;

    // Fallback: top 2 most ordered products per category (from non-cancelled orders)
    const topProducts = await this.orderModel.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalOrdered: { $sum: '$items.quantity' },
        },
      },
      { $sort: { totalOrdered: -1 } },
    ]);

    if (topProducts.length === 0) {
      // No orders at all — return newest 8 products
      return this.productModel
        .find({ isActive: true })
        .populate('category')
        .populate('variants')
        .sort({ createdAt: -1 })
        .limit(8)
        .lean()
        .exec();
    }

    // Load the products and group by category, pick top 2 per category
    const productIds = topProducts.map((p) => p._id);
    const products = await this.productModel
      .find({ _id: { $in: productIds }, isActive: true })
      .populate('category')
      .populate('variants')
      .lean()
      .exec();

    // Preserve order ranking from aggregation
    const rankMap = new Map(productIds.map((id, i) => [id.toString(), i]));
    products.sort(
      (a: any, b: any) =>
        (rankMap.get(a._id.toString()) ?? 999) -
        (rankMap.get(b._id.toString()) ?? 999),
    );

    // Pick top 2 per category
    const perCategory = new Map<string, number>();
    const result: any[] = [];
    for (const product of products) {
      const catId = (product.category as any)?._id?.toString() ?? 'unknown';
      const count = perCategory.get(catId) ?? 0;
      if (count < 2) {
        result.push(product);
        perCategory.set(catId, count + 1);
      }
    }

    return result;
  }
}
