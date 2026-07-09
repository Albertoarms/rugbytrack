exports.handler = async function(event, context) {
  // Solo POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'RESEND_API_KEY no configurada' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  const { to, subject, html, pdfBase64, pdfFilename } = body;

  if (!to || !subject || !html) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Faltan campos: to, subject, html' }) };
  }

  const emailPayload = {
    from: 'RugbyTrack <onboarding@resend.dev>',
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    attachments: pdfBase64 ? [{
      filename: pdfFilename || 'estado-plantel.pdf',
      content: pdfBase64
    }] : []
  };

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data.message || 'Error enviando correo', detail: data })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, id: data.id })
    };

  } catch(err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
