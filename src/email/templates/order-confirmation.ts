import { baseLayout } from './base-layout';

interface OrderConfirmationData {
  customerName: string;
  orderId: string;
  items: Array<{
    name: string;
    weight: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  paymentType: string;
}

export function orderConfirmationTemplate(data: OrderConfirmationData): string {
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

  const content = `
    <h2 style="margin:0 0 8px;color:#333;font-size:20px;">Order Confirmed!</h2>
    <p style="margin:0 0 24px;color:#666;font-size:14px;">
      Hi ${data.customerName}, your order has been placed successfully.
    </p>

    <div style="background-color:#f0faf0;border-left:4px solid #2e7d32;padding:12px 16px;border-radius:4px;margin-bottom:24px;">
      <p style="margin:0;color:#2e7d32;font-size:14px;font-weight:bold;">Order ID: ${data.orderId}</p>
      <p style="margin:4px 0 0;color:#666;font-size:13px;">Payment: ${data.paymentType === 'COD' ? 'Cash on Delivery' : 'Paid Online'}</p>
    </div>

    <h3 style="margin:0 0 12px;color:#333;font-size:16px;">Order Summary</h3>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;color:#333;">
      <tr style="background-color:#fafafa;">
        <th style="padding:8px 0;text-align:left;font-size:12px;color:#888;text-transform:uppercase;">Item</th>
        <th style="padding:8px 0;text-align:center;font-size:12px;color:#888;text-transform:uppercase;">Qty</th>
        <th style="padding:8px 0;text-align:right;font-size:12px;color:#888;text-transform:uppercase;">Amount</th>
      </tr>
      ${itemRows}
      <tr>
        <td colspan="2" style="padding:12px 0;text-align:right;font-weight:bold;font-size:15px;">Total:</td>
        <td style="padding:12px 0;text-align:right;font-weight:bold;font-size:15px;color:#d4440f;">&#8377;${data.totalAmount.toFixed(2)}</td>
      </tr>
    </table>

    <h3 style="margin:24px 0 8px;color:#333;font-size:16px;">Shipping Address</h3>
    <div style="background-color:#fafafa;padding:12px 16px;border-radius:4px;">
      <p style="margin:0;color:#555;font-size:14px;line-height:1.6;">
        ${data.shippingAddress.street}<br>
        ${data.shippingAddress.city}, ${data.shippingAddress.state}<br>
        ${data.shippingAddress.pincode}
      </p>
    </div>
  `;

  return baseLayout('Order Confirmation', content);
}
