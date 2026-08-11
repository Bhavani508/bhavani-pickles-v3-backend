import { baseLayout } from './base-layout';

interface VerifyEmailData {
  name: string;
  verifyUrl: string;
}

export function verifyEmailTemplate(data: VerifyEmailData): string {
  const content = `
    <h2 style="margin:0 0 8px;color:#333;font-size:20px;">Verify Your Email</h2>
    <p style="margin:0 0 24px;color:#666;font-size:14px;">
      Hi ${data.name}, please verify your email address to complete your registration.
    </p>

    <div style="text-align:center;margin:32px 0;">
      <a href="${data.verifyUrl}"
         style="display:inline-block;background-color:#d4440f;color:#ffffff;text-decoration:none;
                padding:14px 32px;border-radius:6px;font-size:16px;font-weight:bold;">
        Verify Email
      </a>
    </div>

    <p style="margin:0 0 16px;color:#999;font-size:12px;text-align:center;">
      This link expires in 24 hours. If you did not create an account, you can ignore this email.
    </p>
  `;

  return baseLayout('Verify Email', content);
}
