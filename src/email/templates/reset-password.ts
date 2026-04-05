export function resetPasswordTemplate(data: { name: string; resetUrl: string }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset Your Password</title>
</head>
<body style="margin:0;padding:0;background:#0d0905;font-family:'Segoe UI',sans-serif;color:#f0ebe0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#1c140c;border:1px solid rgba(240,235,224,0.1);border-radius:10px;padding:40px;">
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <p style="margin:0;font-size:1.5rem;font-weight:700;color:#c8870a;">Bhavani Pickles</p>
            </td>
          </tr>
          <tr>
            <td>
              <h2 style="margin:0 0 12px;color:#f0ebe0;font-size:1.3rem;">Reset Your Password</h2>
              <p style="margin:0 0 20px;color:#a89880;line-height:1.6;">Hi ${data.name},</p>
              <p style="margin:0 0 28px;color:#a89880;line-height:1.6;">
                We received a request to reset your password. Click the button below to set a new password.
                This link is valid for <strong style="color:#f0ebe0;">1 hour</strong>.
              </p>
              <div style="text-align:center;margin-bottom:28px;">
                <a href="${data.resetUrl}" style="display:inline-block;background:#c8870a;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:1rem;">
                  Reset Password
                </a>
              </div>
              <p style="margin:0 0 8px;color:#a89880;font-size:0.85rem;line-height:1.6;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 28px;word-break:break-all;font-size:0.8rem;">
                <a href="${data.resetUrl}" style="color:#c8870a;">${data.resetUrl}</a>
              </p>
              <p style="margin:0;color:#a89880;font-size:0.85rem;line-height:1.6;">
                If you didn't request a password reset, you can safely ignore this email.
                Your password will not be changed.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:32px;border-top:1px solid rgba(240,235,224,0.08);text-align:center;">
              <p style="margin:0;color:#6b5c4e;font-size:0.8rem;">&copy; ${new Date().getFullYear()} Bhavani Pickles. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
