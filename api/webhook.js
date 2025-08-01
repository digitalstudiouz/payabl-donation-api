// api/webhook.js - Обработка webhook от Payabl
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Payabl отправляет данные в URL-encoded формате
    const webhookData = req.body;
    
    console.log('Received webhook:', webhookData);

    // Проверяем подпись для безопасности
    const receivedSecurity = webhookData.security;
    if (!receivedSecurity) {
      console.log('No security signature in webhook');
      return res.status(400).json({ error: 'No security signature' });
    }

    // Находим транзакцию по orderid (это наш transactionId)
    global.transactions = global.transactions || new Map();
    const transaction = global.transactions.get(webhookData.orderid);

    if (!transaction) {
      console.log('Transaction not found for webhook:', webhookData.orderid);
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Определяем статус на основе errorcode
    let status = 'failed';
    if (webhookData.errorcode === '0') {
      status = 'success';
    } else if (webhookData.errorcode === '-10001' || webhookData.errorcode === '-1') {
      status = 'cancelled';
    }

    // Обновляем статус транзакции
    transaction.status = status;
    transaction.updated_at = new Date().toISOString();
    transaction.webhook_data = webhookData;
    transaction.payabl_transaction_id = webhookData.transactionid;
    transaction.error_message = webhookData.errormessage;

    global.transactions.set(transaction.id, transaction);

    console.log(`Transaction ${transaction.id} updated to status: ${status}`);

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}