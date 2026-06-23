const https = require('https');
 
function request(url, options={}, postData=null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 12000
    };
    const req = https.request(opts, res => {
      let body = '';
      const cookies = (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
      res.on('data', d => body += d);
      res.on('end', () => resolve({ body, cookies, status: res.statusCode, headers: res.headers }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (postData) req.write(postData);
    req.end();
  });
}
 
exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
 
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
 
  const action = (event.queryStringParameters || {}).action;
 
  try {
    if (action === 'calendar') {
      const url = 'https://arusa.cl/es/ajax/calendar?fct=8826&fc=1328550&fmc=8077044&fsd=01%2F01%2F2026&fed=31%2F12%2F2026';
      const r = await request(url, { headers: { 'X-Requested-With': 'XMLHttpRequest', 'User-Agent': 'Mozilla/5.0' } });
      return { statusCode: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: r.body };
    }
 
    if (action === 'plantel') {
      const { torneo, match } = event.queryStringParameters || {};
      if (!torneo || !match) throw new Error('Faltan parámetros');
 
      // Paso 1: obtener sesión y CSRF
      const pageUrl = `https://arusa.cl/es/tournament/${torneo}/match/${match}/results`;
      const page = await request(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const csrf = (page.body.match(/name="csrf_token" value="([^"]+)"/) || [])[1];
      if (!csrf) throw new Error('Sin CSRF token');
 
      // Paso 2: pedir estadísticas con sesión
      const boundary = 'X' + Math.random().toString(36).slice(2);
      const body = `--${boundary}\r\nContent-Disposition: form-data; name="csrf_token"\r\n\r\n${csrf}\r\n--${boundary}\r\nContent-Disposition: form-data; name="tab"\r\n\r\nstatistics\r\n--${boundary}--`;
      const tabUrl = `https://arusa.cl/es/ajax/tournament/${torneo}/match/${match}/results/change-tab`;
      const tab = await request(tabUrl, {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': Buffer.byteLength(body),
          'Cookie': page.cookies,
          'User-Agent': 'Mozilla/5.0'
        }
      }, body);
 
      if (tab.status !== 200) throw new Error(`ARUSA devolvió ${tab.status}`);
      return { statusCode: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: tab.body };
    }
 
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'acción inválida' }) };
  } catch(e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
 
