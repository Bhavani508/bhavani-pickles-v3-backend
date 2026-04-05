import { baseLayout } from './base-layout';

interface WelcomeData {
  name: string;
  email?: string;
  password?: string;
  isAutoCreated?: boolean;
}

export function welcomeTemplate(data: WelcomeData): string {
  const introText = data.isAutoCreated
    ? `Hi ${data.name}, we've created an account for you as part of your recent order on Bhavani Pickles.`
    : `Hi ${data.name}, thank you for joining us!`;

  const credentialsBlock = data.isAutoCreated
    ? `<div style="background-color:#f9f9f9;border:1px solid #e0e0e0;border-radius:6px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;color:#333;font-size:15px;font-weight:bold;">Your Login Credentials</p>
      <table role="presentation" cellspacing="0" cellpadding="0" style="font-size:14px;color:#555;">
        <tr>
          <td style="padding:4px 12px 4px 0;font-weight:600;color:#333;">Email:</td>
          <td style="padding:4px 0;">${data.email}</td>
        </tr>
        <tr>
          <td style="padding:4px 12px 4px 0;font-weight:600;color:#333;">Password:</td>
          <td style="padding:4px 0;font-family:monospace;letter-spacing:0.5px;">${data.password}</td>
        </tr>
      </table>
      <p style="margin:12px 0 0;color:#d4440f;font-size:12px;">
        We recommend changing your password after your first login.
      </p>
    </div>`
    : '';

  const content = `
    <h2 style="margin:0 0 8px;color:#333;font-size:20px;">Welcome to Bhavani Pickles!</h2>
    <p style="margin:0 0 24px;color:#666;font-size:14px;">
      ${introText}
    </p>

    ${credentialsBlock}

    <p style="margin:0 0 16px;color:#555;font-size:14px;line-height:1.6;">
      We are delighted to have you as part of the Bhavani Pickles family. Explore our wide range of authentic homemade pickles, spices, powders, and traditional snacks.
    </p>

    <div style="background-color:#fff8f0;border-left:4px solid #d4440f;padding:12px 16px;border-radius:4px;margin-bottom:24px;">
      <p style="margin:0;color:#d4440f;font-size:14px;font-weight:bold;">What we offer</p>
      <ul style="margin:8px 0 0;padding-left:20px;color:#555;font-size:13px;line-height:1.8;">
        <li>Traditional Veg & Non-Veg Pickles</li>
        <li>Authentic Spice Powders</li>
        <li>Homemade Sweets & Snacks</li>
      </ul>
    </div>

    <p style="margin:0;color:#555;font-size:14px;">
      Start exploring and place your first order today!
    </p>
  `;

  return baseLayout('Welcome', content);
}
