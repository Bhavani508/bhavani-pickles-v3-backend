import { baseLayout } from './base-layout';

interface RefundCompletedData {
  customerName: string;
  orderId: string;
  refundAmount: number;
}

export function refundCompletedTemplate(data: RefundCompletedData): string {
  const content = `
    <h2 style="margin:0 0 8px;color:#333;font-size:20px;">Refund Completed</h2>
    <p style="margin:0 0 24px;color:#666;font-size:14px;">
      Hi ${data.customerName}, great news! Your refund has been processed successfully.
    </p>

    <div style="background-color:#f0fdf4;border-left:4px solid #16a34a;padding:16px;border-radius:4px;margin-bottom:24px;">
      <p style="margin:0;color:#16a34a;font-size:14px;font-weight:bold;">Refund Processed</p>
      <p style="margin:8px 0 0;color:#333;font-size:20px;font-weight:bold;">&#8377;${data.refundAmount.toFixed(2)}</p>
      <p style="margin:8px 0 0;color:#666;font-size:13px;">Order ID: ${data.orderId}</p>
    </div>

    <p style="margin:0 0 8px;color:#666;font-size:14px;">
      The refund of <strong>&#8377;${data.refundAmount.toFixed(2)}</strong> has been credited back to your original payment method.
      Please allow 2–3 business days for the amount to reflect in your account, depending on your bank.
    </p>

    <p style="margin:24px 0 0;color:#666;font-size:13px;">
      If the refund doesn't appear within 7 business days, please contact our support team with your order ID.
    </p>
  `;

  return baseLayout('Refund Completed', content);
}
