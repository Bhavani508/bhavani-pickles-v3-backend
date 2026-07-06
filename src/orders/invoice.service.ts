import { Injectable } from '@nestjs/common';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { OrderDocument } from './schemas/order.schema';

/* Brand palette */
const BRAND = '#950220';
const TEXT = '#1a1a1a';
const MUTED = '#6b7280';
const LIGHT_BG = '#faf8f6';
const BORDER = '#e5e2de';
const SUCCESS = '#16a34a';
const WARNING = '#d97706';

const PAGE_W = 595.28; // A4
const M = 50; // margin
const W = PAGE_W - 2 * M; // content width

@Injectable()
export class InvoiceService {
  private readonly logoPath = join(__dirname, 'logo.png');
  private readonly fontRegular = join(__dirname, 'fonts', 'NotoSans-Regular.ttf');
  private readonly fontBold = join(__dirname, 'fonts', 'NotoSans-Bold.ttf');

  generateInvoice(
    order: OrderDocument,
    customerName: string,
    customerEmail: string,
  ): PDFDocument {
    const doc = new PDFDocument({ size: 'A4', margin: M });

    // Register fonts with ₹ support
    doc.registerFont('Sans', this.fontRegular);
    doc.registerFont('Sans-Bold', this.fontBold);
    const orderAny = order as any;
    const orderId = (order._id as any).toString();
    const shortId = orderId.slice(-8).toUpperCase();
    const createdAt = orderAny.createdAt ?? new Date();
    const dateStr = new Date(createdAt).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    // ── Brand stripe at very top ──────────────────────────────────────────
    doc.rect(0, 0, PAGE_W, 4).fill(BRAND);

    // ── Header: Logo + Company + Invoice info ─────────────────────────────
    let y = 28;
    try {
      doc.image(this.logoPath, M, y, { width: 52, height: 52 });
    } catch {
      // fallback if logo file missing
    }

    const logoTextX = M + 62;
    doc
      .fontSize(18)
      .font('Sans-Bold')
      .fillColor(TEXT)
      .text('Bhavani Pickles', logoTextX, y + 6);
    doc
      .fontSize(7.5)
      .font('Sans')
      .fillColor(MUTED)
      .text(
        'Home Made Pickles · Snacks · Sweets',
        logoTextX,
        y + 28,
      );
    doc.text(
      'Sreenidhi Towers, Sri Nagar Colony, Hyderabad 500072',
      logoTextX,
      y + 40,
    );

    // Invoice label — right side
    doc
      .fontSize(24)
      .font('Sans-Bold')
      .fillColor(BRAND)
      .text('INVOICE', M, y, { width: W, align: 'right' });
    doc
      .fontSize(8.5)
      .font('Sans')
      .fillColor(MUTED)
      .text(`#INV-${shortId}`, M, y + 30, { width: W, align: 'right' })
      .text(dateStr, M, y + 42, { width: W, align: 'right' });

    // Thin divider
    y = 92;
    doc.moveTo(M, y).lineTo(M + W, y).strokeColor(BORDER).lineWidth(0.5).stroke();

    // ── Bill To / Ship To — two-column ────────────────────────────────────
    y = 106;
    const colW = W / 2 - 10;

    // Bill To
    doc.fontSize(7).font('Sans-Bold').fillColor(BRAND).text('BILL TO', M, y);
    doc.fontSize(9).font('Sans-Bold').fillColor(TEXT).text(customerName, M, y + 13);
    doc.fontSize(8).font('Sans').fillColor(MUTED).text(customerEmail, M, y + 26);

    // Ship To
    const shipX = M + colW + 20;
    const addr = order.shippingAddress;
    doc.fontSize(7).font('Sans-Bold').fillColor(BRAND).text('SHIP TO', shipX, y);
    doc.fontSize(8.5).font('Sans').fillColor(TEXT).text(addr.street, shipX, y + 13, { width: colW });
    doc.text(`${addr.city}, ${addr.state} – ${addr.pincode}`, shipX, y + 26, { width: colW });
    if (addr.phone) doc.text(addr.phone, shipX, y + 39, { width: colW });

    // ── Order meta row ────────────────────────────────────────────────────
    y = 162;
    doc.rect(M, y, W, 28).fill(LIGHT_BG);
    doc.fillColor(TEXT);

    const metaCols = [
      { label: 'Order', value: `#${shortId}` },
      { label: 'Date', value: dateStr },
      { label: 'Payment', value: order.paymentType === 'COD' ? 'Cash on Delivery' : 'Online' },
      { label: 'Status', value: order.isPaid ? 'Paid' : 'Unpaid' },
    ];
    const metaW = W / metaCols.length;
    metaCols.forEach((m, i) => {
      const mx = M + i * metaW + 10;
      doc.fontSize(6.5).font('Sans').fillColor(MUTED).text(m.label.toUpperCase(), mx, y + 5);
      doc.fontSize(8.5).font('Sans-Bold').fillColor(TEXT).text(m.value, mx, y + 15);
    });

    // ── Items Table ───────────────────────────────────────────────────────
    y = 206;
    const col = { name: M, weight: M + 220, qty: M + 310, price: M + 370, subtotal: M + 440 };
    const colWidths = { name: 210, weight: 80, qty: 50, price: 65, subtotal: W - 440 };

    // Table header
    doc
      .moveTo(M, y + 14)
      .lineTo(M + W, y + 14)
      .strokeColor(BRAND)
      .lineWidth(1.5)
      .stroke();
    doc.fontSize(7).font('Sans-Bold').fillColor(MUTED);
    doc.text('PRODUCT', col.name, y + 2, { width: colWidths.name });
    doc.text('WEIGHT', col.weight, y + 2, { width: colWidths.weight });
    doc.text('QTY', col.qty, y + 2, { width: colWidths.qty, align: 'center' });
    doc.text('PRICE', col.price, y + 2, { width: colWidths.price, align: 'right' });
    doc.text('SUBTOTAL', col.subtotal, y + 2, { width: colWidths.subtotal, align: 'right' });

    // Table rows
    let rowY = y + 24;
    const items = order.items as any[];
    const rowH = 22;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (i % 2 === 0) {
        doc.rect(M, rowY - 5, W, rowH).fill(LIGHT_BG);
      }

      doc.fontSize(8.5).font('Sans').fillColor(TEXT);
      doc.text(item.name, col.name + 2, rowY, { width: colWidths.name - 2 });
      doc.fillColor(MUTED).text(item.weight, col.weight, rowY, { width: colWidths.weight });
      doc.fillColor(TEXT).text(String(item.quantity), col.qty, rowY, { width: colWidths.qty, align: 'center' });
      doc.text(`₹${item.price.toFixed(2)}`, col.price, rowY, { width: colWidths.price, align: 'right' });
      doc.font('Sans-Bold').text(
        `₹${(item.price * item.quantity).toFixed(2)}`,
        col.subtotal,
        rowY,
        { width: colWidths.subtotal, align: 'right' },
      );
      rowY += rowH;
    }

    // Bottom border
    doc.moveTo(M, rowY + 2).lineTo(M + W, rowY + 2).strokeColor(BORDER).lineWidth(0.5).stroke();

    // ── Totals section ────────────────────────────────────────────────────
    const totalBlockX = M + W - 180;
    const totalBlockW = 180;
    let ty = rowY + 16;

    // Subtotal
    doc.fontSize(8.5).font('Sans').fillColor(MUTED);
    doc.text('Subtotal', totalBlockX, ty, { width: 90 });
    doc.fillColor(TEXT).text(`₹${order.totalAmount.toFixed(2)}`, totalBlockX + 90, ty, { width: 90, align: 'right' });

    ty += 18;
    doc.moveTo(totalBlockX, ty).lineTo(totalBlockX + totalBlockW, ty).strokeColor(BORDER).lineWidth(0.5).stroke();
    ty += 8;

    // Total
    doc.fontSize(12).font('Sans-Bold').fillColor(TEXT);
    doc.text('Total', totalBlockX, ty, { width: 90 });
    doc.text(`₹${order.totalAmount.toFixed(2)}`, totalBlockX + 90, ty, { width: 90, align: 'right' });

    // Payment badge
    ty += 26;
    const badgeColor = order.isPaid ? SUCCESS : WARNING;
    const badgeText = order.isPaid ? 'PAID' : 'UNPAID';
    const badgeW = 60;
    const badgeX = totalBlockX + totalBlockW - badgeW;
    doc.roundedRect(badgeX, ty - 2, badgeW, 16, 3).fill(badgeColor);
    doc
      .fontSize(7.5)
      .font('Sans-Bold')
      .fillColor('#ffffff')
      .text(badgeText, badgeX, ty + 1, { width: badgeW, align: 'center' });

    // ── Footer ────────────────────────────────────────────────────────────
    doc.fillColor(TEXT);
    const footerY = 760;

    // Thank you message
    doc
      .fontSize(10)
      .font('Sans-Bold')
      .fillColor(TEXT)
      .text('Thank you for your order!', M, footerY - 30, { width: W, align: 'center' });

    // Footer divider
    doc.moveTo(M, footerY).lineTo(M + W, footerY).strokeColor(BORDER).lineWidth(0.5).stroke();

    // Contact info
    doc
      .fontSize(7)
      .font('Sans')
      .fillColor(MUTED)
      .text(
        '+91 8897522993  ·  support@bhavanipickles.in  ·  www.bhavanipickles.com',
        M,
        footerY + 8,
        { width: W, align: 'center' },
      );
    doc.text(
      'Sreenidhi Towers, Sri Nagar Colony, Hyderabad, Telangana 500072',
      M,
      footerY + 19,
      { width: W, align: 'center' },
    );

    // Bottom brand stripe
    doc.rect(0, 841.89 - 4, PAGE_W, 4).fill(BRAND);

    doc.end();
    return doc;
  }
}
