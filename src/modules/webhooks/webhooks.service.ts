import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../../config/db.js";
import { invoices, payments, financeTransactions, webhookLogs } from "../../db/schema.js";
import { env } from "../../config/env.js";

export class WebhooksService {
  /**
   * Handle Midtrans Payment Notification Callback
   */
  static async handleMidtrans(payload: any) {
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      payment_type,
      transaction_id,
    } = payload;

    // 1. Signature Verification
    if (signature_key && env.MIDTRANS_SERVER_KEY) {
      const hashSource = `${order_id}${status_code}${gross_amount}${env.MIDTRANS_SERVER_KEY}`;
      const expectedSignature = crypto.createHash("sha512").update(hashSource).digest("hex");

      if (signature_key !== expectedSignature && env.NODE_ENV === "production") {
        await db.insert(webhookLogs).values({
          provider: "midtrans",
          eventType: "payment_notification",
          payload: JSON.stringify(payload),
          status: "failed",
          responseMessage: "Invalid signature key",
        });
        throw new Error("Invalid signature key");
      }
    }

    // 2. Log webhook
    const [log] = await db
      .insert(webhookLogs)
      .values({
        provider: "midtrans",
        eventType: `midtrans_${transaction_status}`,
        payload: JSON.stringify(payload),
        status: "received",
      })
      .returning();

    // 3. Process payment status
    if (
      transaction_status === "settlement" ||
      (transaction_status === "capture" && payload.fraud_status === "accept")
    ) {
      // Find matching invoice
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.invoiceNumber, order_id))
        .limit(1);

      if (invoice) {
        const paidAmount = Number(gross_amount);

        // Record approved payment
        const paymentNumber = `PAY/MIDTRANS/${transaction_id || Math.random().toString(36).substring(2, 7)}`;
        await db.insert(payments).values({
          invoiceId: invoice.id,
          paymentNumber,
          amount: paidAmount.toString(),
          paymentMethod: "midtrans",
          gatewayTransactionId: transaction_id,
          status: "approved",
          notes: `Midtrans payment via ${payment_type}`,
        });

        // Update invoice balance
        const currentPaid = Number(invoice.paidAmount);
        const newPaid = currentPaid + paidAmount;
        const total = Number(invoice.totalAmount);
        const newRemaining = Math.max(0, total - newPaid);

        await db
          .update(invoices)
          .set({
            paidAmount: newPaid.toString(),
            remainingAmount: newRemaining.toString(),
            status: newRemaining === 0 ? "paid" : "partially_paid",
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, invoice.id));

        // Record in finance income
        await db.insert(financeTransactions).values({
          branchId: invoice.branchId,
          userId: invoice.tenantId, // Recorded tenant context
          category: "rental_income",
          type: "income",
          amount: paidAmount.toString(),
          description: `Online Midtrans settlement for ${invoice.invoiceNumber} (${payment_type})`,
          approvalStatus: "approved",
        });

        await db
          .update(webhookLogs)
          .set({ status: "processed", responseMessage: `Invoice ${order_id} marked as paid` })
          .where(eq(webhookLogs.id, log.id));
      }
    }

    return { status: "OK", message: "Midtrans webhook processed successfully" };
  }

  /**
   * Handle Xendit Payment Callback
   */
  static async handleXendit(payload: any, callbackToken?: string) {
    const { external_id, status, paid_amount, payment_method, payment_channel, id } = payload;

    const [log] = await db
      .insert(webhookLogs)
      .values({
        provider: "xendit",
        eventType: `xendit_${status?.toLowerCase()}`,
        payload: JSON.stringify(payload),
        status: "received",
      })
      .returning();

    if (status === "PAID") {
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.invoiceNumber, external_id))
        .limit(1);

      if (invoice) {
        const amount = Number(paid_amount);

        await db.insert(payments).values({
          invoiceId: invoice.id,
          paymentNumber: `PAY/XENDIT/${id || Math.random().toString(36).substring(2, 7)}`,
          amount: amount.toString(),
          paymentMethod: "xendit",
          gatewayTransactionId: id,
          status: "approved",
          notes: `Xendit payment via ${payment_method} (${payment_channel})`,
        });

        await db
          .update(invoices)
          .set({
            paidAmount: amount.toString(),
            remainingAmount: "0.00",
            status: "paid",
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, invoice.id));

        await db.insert(financeTransactions).values({
          branchId: invoice.branchId,
          userId: invoice.tenantId,
          category: "rental_income",
          type: "income",
          amount: amount.toString(),
          description: `Xendit payment for invoice ${invoice.invoiceNumber}`,
          approvalStatus: "approved",
        });

        await db
          .update(webhookLogs)
          .set({ status: "processed", responseMessage: `Invoice ${external_id} marked as paid` })
          .where(eq(webhookLogs.id, log.id));
      }
    }

    return { status: "OK", message: "Xendit webhook processed successfully" };
  }

  /**
   * Handle WhatsApp Gateway Message Status Callback
   */
  static async handleWhatsApp(payload: any) {
    await db.insert(webhookLogs).values({
      provider: "whatsapp",
      eventType: "status_callback",
      payload: JSON.stringify(payload),
      status: "processed",
      responseMessage: `WhatsApp status callback: ${payload.status || "received"}`,
    });

    return { status: "OK", message: "WhatsApp callback processed" };
  }

  /**
   * Send / simulate WhatsApp notification message
   */
  static async sendWhatsAppNotification(phone: string, message: string) {
    // In production, dispatch via Fonnte / Wablas / Meta Cloud API
    console.log(`📱 [WhatsApp Notification sent to ${phone}]:\n"${message}"`);

    await db.insert(webhookLogs).values({
      provider: "whatsapp_outbound",
      eventType: "message_dispatch",
      payload: JSON.stringify({ phone, message, timestamp: new Date() }),
      status: "processed",
      responseMessage: "Message sent to gateway",
    });

    return {
      success: true,
      recipient: phone,
      message,
      sentAt: new Date(),
    };
  }
}
