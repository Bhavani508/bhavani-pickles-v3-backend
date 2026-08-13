import { baseLayout } from './base-layout';

interface OrderCancelledData {
  customerName: string;
  orderId: string;
  items: Array<{
    name: string;
    weight: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  shippingCost?: number;
  reason?: string;
  cancelledBy: string;
  refundInitiated?: boolean;
}

export function orderCancelledTemplate(data: OrderCancelledData): string {
  const itemRows = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;">
          ${item.name}<br>
          <span style="color:#888;font-size:12px;">${item.weight}</span>
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:center;">${item.quantity}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right;">&#8377;${(item.price * item.quantity).toFixed(2)}</td>
      </tr>`,
    )
    .join('');

  const refundBlock = data.refundInitiated
    ? `
    <div style="background-color:#eff6ff;border-left:4px solid #2563eb;padding:12px 16px;border-radius:4px;margin-top:24px;">
      <p style="margin:0;color:#2563eb;font-size:14px;font-weight:bold;">Refund In Process</p>
      <p style="margin:8px 0 0;color:#666;font-size:13px;">
        A refund of &#8377;${data.totalAmount.toFixed(2)} has been initiated to your original payment method.
        It typically takes 5–7 business days to reflect in your account. You will receive another email once the refund is completed.
      </p>
    </div>`
    : '';

  const content = `
    <h2 style="margin:0 0 8px;color:#333;font-size:20px;">Order Cancelled</h2>
    <p style="margin:0 0 24px;color:#666;font-size:14px;">
      Hi ${data.customerName}, your order has been cancelled${data.cancelledBy === 'admin' ? ' by our team' : ''}.
    </p>

    <div style="background-color:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:4px;margin-bottom:24px;">
      <p style="margin:0;color:#dc2626;font-size:14px;font-weight:bold;">Order ID: ${data.orderId}</p>
      ${data.reason ? `<p style="margin:8px 0 0;color:#666;font-size:13px;">Reason: ${data.reason}</p>` : ''}
    </div>

    <h3 style="margin:0 0 12px;color:#333;font-size:16px;">Cancelled Items</h3>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;color:#333;">
      <tr style="background-color:#fafafa;">
        <th style="padding:8px 0;text-align:left;font-size:12px;color:#888;text-transform:uppercase;">Item</th>
        <th style="padding:8px 0;text-align:center;font-size:12px;color:#888;text-transform:uppercase;">Qty</th>
        <th style="padding:8px 0;text-align:right;font-size:12px;color:#888;text-transform:uppercase;">Amount</th>
      </tr>
      ${itemRows}
      <tr>
        <td colspan="2" style="padding:8px 0;text-align:right;color:#888;font-size:14px;">Subtotal:</td>
        <td style="padding:8px 0;text-align:right;color:#333;font-size:14px;">&#8377;${(data.totalAmount - (data.shippingCost ?? 0)).toFixed(2)}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding:4px 0;text-align:right;color:#888;font-size:14px;">Shipping:</td>
        <td style="padding:4px 0;text-align:right;color:#333;font-size:14px;">${(data.shippingCost ?? 0) > 0 ? `&#8377;${(data.shippingCost!).toFixed(2)}` : 'Free'}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding:12px 0;text-align:right;font-weight:bold;font-size:15px;border-top:1px solid #e0e0e0;">Total:</td>
        <td style="padding:12px 0;text-align:right;font-weight:bold;font-size:15px;color:#dc2626;text-decoration:line-through;border-top:1px solid #e0e0e0;">&#8377;${data.totalAmount.toFixed(2)}</td>
      </tr>
    </table>

    ${refundBlock}

    <p style="margin:24px 0 0;color:#666;font-size:13px;">
      If you have any questions, please contact our support team.
    </p>
  `;

  return baseLayout('Order Cancelled', content);
}
