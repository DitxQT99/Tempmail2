export default async function handler(req, res) {
  const start = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    if (req.method !== 'GET') {
      return res.status(405).json({
        author: 'Ventz',
        service: 'Tempnail API',
        version: '3.0.0',
        status: 'error',
        code: 405,
        timestamp: new Date().toISOString(),
        request_id: requestId,
        error: { message: 'Method not allowed' }
      });
    }

    const response = await fetch('https://www.1secmail.com/api/v1/?action=genRandomMailbox&count=1');
    if (!response.ok) {
      throw new Error(`1secmail API error: ${response.status}`);
    }

    const data = await response.json(); // array of one email string

    return res.status(200).json({
      author: 'Ventz',
      service: 'Tempnail API',
      version: '3.0.0',
      status: 'success',
      code: 200,
      timestamp: new Date().toISOString(),
      request_id: requestId,
      data: { email: data[0] },
      meta: {
        execution_time_ms: Date.now() - start
      }
    });

  } catch (error) {
    return res.status(500).json({
      author: 'Ventz',
      service: 'Tempnail API',
      version: '3.0.0',
      status: 'error',
      code: 500,
      timestamp: new Date().toISOString(),
      request_id: requestId,
      error: { message: error.message || 'Internal server error' }
    });
  }
  }
