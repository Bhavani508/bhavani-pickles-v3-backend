import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum';

export type UserDocument = HydratedDocument<User>;

@Schema({ _id: true })
export class Address {
  @Prop({ required: true })
  label!: string;

  @Prop({ required: true })
  line1!: string;

  @Prop()
  line2?: string;

  @Prop({ required: true })
  city!: string;

  @Prop({ required: true })
  state!: string;

  @Prop({ required: true })
  pincode!: string;

  @Prop({ default: 'IN' })
  country!: string;

  @Prop()
  phone?: string;

  @Prop({ default: false })
  isDefault!: boolean;
}

const AddressSchema = SchemaFactory.createForClass(Address);

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true, select: false })
  password!: string;

  @Prop({ default: Role.USER, enum: Role })
  role!: Role;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop()
  phone?: string;

  @Prop({ type: [AddressSchema], default: [] })
  addresses!: Address[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Product' }], default: [] })
  wishlist!: Types.ObjectId[];

  @Prop({ select: false })
  resetPasswordToken?: string;

  @Prop({ select: false })
  resetPasswordExpires?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
