import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ShiprocketService } from './shiprocket.service';

@Module({
  imports: [ConfigModule],
  providers: [ShiprocketService],
  exports: [ShiprocketService],
})
export class ShippingModule {}
