import { baseLayout } from './base-layout';

interface OrderStatusUpdateData {
  customerName: string;
  orderId: string;
  status: string;
}

const statusConfig: Record<
  string,
  { label: string; color: string; message: string }
> = {
  processing: {
    label: 'Processing',
    color: '#f59e0b',
    message: 'Your order is being prepared and will be shipped soon.',
  },
  shipped: {
    label: 'Shipped',
    color: '#3b82f6',
    message: 'Your order has been shipped and is on its way!',
  },
  delivered: {
    label: 'Delivered',
    color: '#2e7d32',
    message: 'Your order has been delivered. Enjoy your pickles!',
  },
};

export function orderStatusUpdateTemplate(data: OrderStatusUpdateData): string {
  const config = statusConfig[data.status] || {
    label: data.status,
    color: '#666',
    message: `Your order status has been updated to ${data.status}.`,
  };

  const content = `
    <h2 style="margin:0 0 8px;color:#333;font-size:20px;">Order Update</h2>
    <p style="margin:0 0 24px;color:#666;font-size:14px;">
      Hi ${data.customerName}, here's an update on your order.
    </p>

    <div style="background-color:#f8f9fa;border-left:4px solid ${config.color};padding:16px;border-radius:4px;margin-bottom:24px;">
      <p style="margin:0;color:#333;font-size:13px;">Order ID</p>
      <p style="margin:4px 0 12px;color:#333;font-size:15px;font-weight:bold;">${data.orderId}</p>
      <p style="margin:0;color:#333;font-size:13px;">Status</p>
      <p style="margin:4px 0 0;font-size:18px;font-weight:bold;color:${config.color};">${config.label}</p>
    </div>

    <p style="margin:0;color:#555;font-size:14px;line-height:1.6;">
      ${config.message}
    </p>
  `;

  return baseLayout('Order Status Update', content);
}
