// api/create-payment.js - Vercel serverless function
export default async function handler(req, res) {
  // Разрешаем CORS для Tilda
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount } = req.body;

    // Валидация суммы
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Генерируем уникальный ID для транзакции
    const transactionId = `donation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Настройки для Payabl API
    const payablConfig = {
      merchantId: process.env.PAYABL_MERCHANT_ID || 'gateway_test_3d', // Тестовый merchant ID
      secret: process.env.PAYABL_SECRET || 'b185', // Тестовый secret
      baseUrl: 'https://sandbox.payabl.com'
    };

    // Функция для создания подписи
    function createSignature(params, secret) {
      // Сортируем параметры по ключу и формируем строку
      const sortedKeys = Object.keys(params).sort();
      const paramString = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
      const stringToSign = paramString + secret;
      
      // Создаем MD5 хеш (в реальности лучше использовать crypto-js)
      const crypto = require('crypto');
      return crypto.createHash('md5').update(stringToSign).digest('hex');
    }

    // Подготавливаем данные для Payabl
    const returnUrl = `${req.headers.origin || 'https://oneislandoneheart.cityfriends.club'}?payment=completed&ref=${transactionId}`;
    const notificationUrl = `https://${req.headers.host}/api/webhook`;
    
    const paymentParams = {
      merchantid: payablConfig.merchantId,
      orderid: transactionId,
      amount: parseFloat(amount).toFixed(2),
      currency: 'USD',
      url_return: returnUrl,
      notification_url: notificationUrl,
      email: 'donor@example.com', // Тестовый email
      firstname: 'Anonymous',
      lastname: 'Donor',
      customerip: req.headers['x-forwarded-for'] || req.connection.remoteAddress || '127.0.0.1'
    };

    // Создаем подпись
    paymentParams.signature = createSignature(paymentParams, payablConfig.secret);

    // Преобразуем в URL-encoded формат
    const formData = new URLSearchParams(paymentParams).toString();

    // Отправляем запрос к Payabl API
    const response = await fetch(`${payablConfig.baseUrl}/pay/payment/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData
    });

    // Парсим ответ (Payabl возвращает URL-encoded данные)
    const responseText = await response.text();
    const result = new URLSearchParams(responseText);
    
    const errorcode = result.get('errorcode');
    if (errorcode !== '0') {
      console.error('Payabl API error:', responseText);
      return res.status(400).json({ 
        error: 'Payment creation failed',
        details: result.get('errormessage') || 'Unknown error'
      });
    }

    // Сохраняем информацию о транзакции во временное хранилище
    global.transactions = global.transactions || new Map();
    global.transactions.set(transactionId, {
      id: transactionId,
      amount: amount,
      status: 'pending',
      created_at: new Date().toISOString(),
      payabl_transaction_id: result.get('transactionid'),
      session_id: result.get('sessionid')
    });

    // Возвращаем URL для редиректа
    return res.status(200).json({
      success: true,
      payment_url: result.get('start_url'),
      transaction_id: transactionId
    });

  } catch (error) {
    console.error('Error creating payment:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}