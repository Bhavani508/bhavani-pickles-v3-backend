import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const BASE_URL = 'https://apiv2.shiprocket.in/v1/external';

interface ShiprocketToken {
  token: string;
  expiresAt: number; // epoch ms
}

export interface ShiprocketOrderPayload {
  orderId: string;
  orderDate: string; // 'YYYY-MM-DD HH:mm'
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  shippingCountry: string;
  items: {
    name: string;
    sku: string;
    units: number;
    sellingPrice: number;
  }[];
  paymentMethod: 'Prepaid' | 'COD';
  subTotal: number;
  weight: number; // in kg
  length: number; // in cm
  breadth: number;
  height: number;
}

export interface ShiprocketCreateResponse {
  order_id: number;
  shipment_id: number;
  status: string;
}

export interface CourierAssignResponse {
  response: {
    data: {
      awb_code: string;
      courier_name: string;
      courier_company_id: number;
    };
  };
}

export interface TrackingResponse {
  tracking_data: {
    track_status: number;
    shipment_status: number;
    shipment_track: {
      current_status: string;
      delivered_date?: string;
      awb_code: string;
      courier_name: string;
    }[];
    shipment_track_activities: {
      date: string;
      status: string;
      activity: string;
      location: string;
    }[];
    track_url: string;
  };
}

@Injectable()
export class ShiprocketService {
  private readonly logger = new Logger(ShiprocketService.name);
  private cachedToken: ShiprocketToken | null = null;

  constructor(private config: ConfigService) {}

  private isConfigured(): boolean {
    return !!(this.config.get('SHIPROCKET_EMAIL') && this.config.get('SHIPROCKET_PASSWORD'));
  }

  // ── Token management ──────────────────────────────────────────────────────

  private async getToken(): Promise<string> {
    // Token valid for 10 days, refresh with 1 day buffer
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt) {
      return this.cachedToken.token;
    }

    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: this.config.get('SHIPROCKET_EMAIL'),
        password: this.config.get('SHIPROCKET_PASSWORD'),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Shiprocket auth failed: ${res.status} ${body}`);
      throw new Error('Shiprocket authentication failed');
    }

    const data = await res.json();
    this.cachedToken = {
      token: data.token,
      expiresAt: Date.now() + 9 * 24 * 60 * 60 * 1000, // 9 days
    };

    return data.token;
  }

  private async request<T>(method: string, path: string, body?: any): Promise<T> {
    const token = await this.getToken();
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Shiprocket ${method} ${path} failed: ${res.status} ${text}`);
      throw new Error(`Shiprocket API error: ${res.status}`);
    }

    return res.json() as Promise<T>;
  }

  // ── Create order on Shiprocket ────────────────────────────────────────────

  async createOrder(payload: ShiprocketOrderPayload): Promise<ShiprocketCreateResponse> {
    if (!this.isConfigured()) throw new Error('Shiprocket not configured');

    const nameParts = payload.customerName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return this.request<ShiprocketCreateResponse>('POST', '/orders/create/adhoc', {
      order_id: payload.orderId,
      order_date: payload.orderDate,
      pickup_location: this.config.get('SHIPROCKET_PICKUP_LOCATION', 'Primary'),
      channel_id: '',
      billing_customer_name: firstName,
      billing_last_name: lastName,
      billing_address: payload.shippingAddress,
      billing_city: payload.shippingCity,
      billing_state: payload.shippingState,
      billing_pincode: payload.shippingPincode,
      billing_country: payload.shippingCountry,
      billing_email: payload.customerEmail,
      billing_phone: payload.customerPhone,
      shipping_is_billing: true,
      order_items: payload.items.map((item, i) => ({
        name: item.name,
        sku: item.sku || `SKU-${i + 1}`,
        units: item.units,
        selling_price: item.sellingPrice,
      })),
      payment_method: payload.paymentMethod,
      sub_total: payload.subTotal,
      weight: payload.weight,
      length: payload.length,
      breadth: payload.breadth,
      height: payload.height,
    });
  }

  // ── Assign courier (auto-select recommended) ──────────────────────────────

  async assignCourier(shipmentId: number): Promise<CourierAssignResponse> {
    return this.request<CourierAssignResponse>('POST', '/courier/assign/awb', {
      shipment_id: shipmentId,
    });
  }

  // ── Schedule pickup ───────────────────────────────────────────────────────

  async generatePickup(shipmentId: number): Promise<any> {
    return this.request('POST', '/courier/generate/pickup', {
      shipment_id: [shipmentId],
    });
  }

  // ── Generate shipping label ───────────────────────────────────────────────

  async generateLabel(shipmentId: number): Promise<{ label_url: string }> {
    return this.request<{ label_url: string }>('POST', '/courier/generate/label', {
      shipment_id: [shipmentId],
    });
  }

  // ── Get tracking info ─────────────────────────────────────────────────────

  async getTracking(awbCode: string): Promise<TrackingResponse> {
    return this.request<TrackingResponse>('GET', `/courier/track/awb/${awbCode}`);
  }

  async getTrackingByShipment(shipmentId: number): Promise<TrackingResponse> {
    return this.request<TrackingResponse>('GET', `/courier/track/shipment/${shipmentId}`);
  }

  async checkServiceability(
    pickupPincode: string,
    deliveryPincode: string,
    weight: number,
    codEnabled: boolean,
  ): Promise<{ available: boolean; couriers: Array<{ name: string; rate: number; etd: string; courier_company_id: number }> }> {
    if (!this.isConfigured()) return { available: false, couriers: [] };

    try {
      const res = await this.request<any>('GET',
        `/courier/serviceability/?pickup_postcode=${pickupPincode}&delivery_postcode=${deliveryPincode}&weight=${weight}&cod=${codEnabled ? 1 : 0}`
      );

      const couriers = (res?.data?.available_courier_companies ?? []).map((c: any) => ({
        name: c.courier_name,
        rate: c.freight_charge,
        etd: c.etd,
        courier_company_id: c.courier_company_id,
      }));

      return { available: couriers.length > 0, couriers };
    } catch {
      return { available: false, couriers: [] };
    }
  }

  async cancelOrder(shiprocketOrderId: number): Promise<any> {
    return this.request('POST', '/orders/cancel', {
      ids: [shiprocketOrderId],
    });
  }
}
