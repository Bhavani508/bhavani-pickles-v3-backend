import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Model, Types } from 'mongoose';
import { AddressDto } from './dto/address.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    const existing = await this.userModel.findOne({
      email: createUserDto.email,
    });
    if (existing) throw new ConflictException('Email already in use');
    const hashedPassword = await bcrypt.hash(createUserDto.password, 12);
    const user = new this.userModel({
      ...createUserDto,
      password: hashedPassword,
    });
    return user.save();
  }

  async findAll(): Promise<UserDocument[]> {
    return this.userModel.find({ isActive: true }).exec();
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).select('+password').exec();
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserDocument> {
    const user = await this.userModel.findByIdAndUpdate(id, updateUserDto, {
      new: true,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async addAddress(userId: string, dto: AddressDto): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (dto.isDefault) {
      user.addresses.forEach((a) => (a.isDefault = false));
    }
    user.addresses.push(dto as any);
    return user.save();
  }

  async deleteAddress(
    userId: string,
    addressId: string,
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const idx = user.addresses.findIndex(
      (a) => (a as any)._id.toString() === addressId,
    );
    if (idx === -1) throw new NotFoundException('Address not found');
    user.addresses.splice(idx, 1);
    return user.save();
  }

  async setDefaultAddress(
    userId: string,
    addressId: string,
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const found = user.addresses.find(
      (a) => (a as any)._id.toString() === addressId,
    );
    if (!found) throw new NotFoundException('Address not found');

    user.addresses.forEach((a) => (a.isDefault = false));
    found.isDefault = true;
    return user.save();
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.userModel.findById(userId).select('+password');
    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!valid)
      throw new UnauthorizedException('Current password is incorrect');

    user.password = await bcrypt.hash(dto.newPassword, 12);
    await user.save();
  }

  async remove(id: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, { isActive: false });
  }

  async createPasswordResetToken(email: string): Promise<{ token: string; name: string } | null> {
    const user = await this.userModel.findOne({ email: email.toLowerCase() });
    if (!user || !user.isActive) return null; // silently return null to prevent email enumeration

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.userModel.findByIdAndUpdate(user._id, {
      resetPasswordToken: token,
      resetPasswordExpires: expires,
    });

    return { token, name: user.name };
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.userModel
      .findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: new Date() },
      })
      .select('+resetPasswordToken +resetPasswordExpires');

    if (!user) throw new BadRequestException('Reset link is invalid or has expired');

    user.password = await bcrypt.hash(newPassword, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
  }

  async getWishlist(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .populate({ path: 'wishlist', populate: ['category', 'variants'] })
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return user.wishlist;
  }

  async toggleWishlist(userId: string, productId: string): Promise<{ wishlisted: boolean }> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const pid = new Types.ObjectId(productId);
    const idx = user.wishlist.findIndex((id) => id.equals(pid));

    if (idx === -1) {
      user.wishlist.push(pid);
    } else {
      user.wishlist.splice(idx, 1);
    }
    await user.save();
    return { wishlisted: idx === -1 };
  }
}
