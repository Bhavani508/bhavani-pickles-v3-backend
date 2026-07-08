import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Category } from '../../categories/schemas/category.schema';
import { ProductVariant } from './product-variant.schema';

export { ProductVariant } from './product-variant.schema';
export type ProductDocument = HydratedDocument<Product>;

@Schema({ timestamps: true })
export class Product {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Category', required: true })
  category!: Category;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'ProductVariant' }], default: [] })
  variants!: ProductVariant[];

  @Prop({ type: [String], default: [] })
  images!: string[];

  @Prop({ min: 0, max: 5, default: 0 })
  rating!: number;

  @Prop({ default: 0 })
  reviewCount!: number;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: false })
  isOutOfStock!: boolean;

  @Prop({ default: false })
  isBestSeller!: boolean;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop()
  ingredients?: string;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });
