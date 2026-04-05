export function baseLayout(title: string, content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f4;padding:20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color:#d4440f;padding:24px;text-align:center;">
              <img src="https://res.cloudinary.com/dnjfl8fv0/image/upload/v1774363128/bhavani-pickles/branding/logo.svg" alt="Bhavani Pickles" width="120" height="120" style="display:block;margin:0 auto 12px;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:bold;">Bhavani Pickles</h1>
              <p style="margin:4px 0 0;color:#ffe0d0;font-size:13px;">Authentic Homemade Pickles & Spices</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 24px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#fafafa;padding:20px 24px;text-align:center;border-top:1px solid #eee;">
              <p style="margin:0;color:#888;font-size:12px;">Thank you for choosing Bhavani Pickles!</p>
              <p style="margin:8px 0 0;color:#aaa;font-size:11px;">This is an automated email. Please do not reply.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
