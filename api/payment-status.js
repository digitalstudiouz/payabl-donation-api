// api/payment-status.js - Проверка статуса платежа
export default async function handler(req, res) {
  // Разрешаем CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { ref } = req.query;

    if (!ref) {
      return res.status(400).json({ error: 'Transaction reference required' });
    }

    // Ищем транзакцию
    global.transactions = global.transactions || new Map();
    const transaction = global.transactions.get(ref);

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Возвращаем статус
    return res.status(200).json({
      success: true,
      transaction: {
        id: transaction.id,
        amount: transaction.amount,
        status: transaction.status,
        created_at: transaction.created_at,
        updated_at: transaction.updated_at
      }
    });

  } catch (error) {
    console.error('Error checking payment status:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}