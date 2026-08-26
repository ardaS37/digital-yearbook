function normalizeIp(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  const first = raw.split(',')[0].trim();
  return first.startsWith('::ffff:') ? first.slice(7) : first;
}

function resolveClientIp(req) {
  const forwardedFor = req.get('x-forwarded-for') || '';
  const realIp = req.get('x-real-ip') || '';
  const candidate = forwardedFor || realIp || req.ip || req.socket.remoteAddress || '';
  return {
    ipAddress: normalizeIp(candidate),
    ipChain: forwardedFor || realIp || ''
  };
}

function detectBrowserFromClientHints(secChUa) {
  if (!secChUa) return null;
  const brands = [];
  const regex = /"([^"]+)";\s*v="([^"]+)"/g;
  let m;
  while ((m = regex.exec(secChUa)) !== null) {
    brands.push({ name: m[1], version: m[2] });
  }
  if (!brands.length) return null;
  const significant = brands.filter(
    (b) => b.name !== 'Not A;Brand' && b.name !== 'Not;A Brand' && b.name !== 'Not/A)Brand' && !b.name.startsWith('Not')
  );
  const hasBrave = significant.some((b) => b.name === 'Brave');
  const edge = significant.find((b) => b.name === 'Microsoft Edge');
  const opera = significant.find((b) => b.name === 'Opera');
  const chrome = significant.find((b) => b.name === 'Google Chrome');
  const chromium = significant.find((b) => b.name === 'Chromium');
  if (hasBrave) return { name: 'Brave', version: (chromium || {}).version || '' };
  if (edge) return { name: 'Edge', version: edge.version };
  if (opera) return { name: 'Opera', version: opera.version };
  if (chrome) return { name: 'Chrome', version: chrome.version };
  if (chromium) return { name: 'Chromium', version: chromium.version };
  return null;
}

function detectBrowser(userAgent, headers) {
  const hints = detectBrowserFromClientHints((headers || {})['sec-ch-ua'] || '');
  if (hints) return hints;
  const ua = String(userAgent || '');
  if (!ua) {
    return { name: 'Tarayici bilgisi yok', version: '' };
  }
  const patterns = [
    { name: 'Edge', regex: /Edg\/([\d.]+)/ },
    { name: 'Opera', regex: /OPR\/([\d.]+)/ },
    { name: 'Chrome', regex: /Chrome\/([\d.]+)/ },
    { name: 'Firefox', regex: /Firefox\/([\d.]+)/ },
    { name: 'Safari', regex: /Version\/([\d.]+).*Safari/ }
  ];

  for (const pattern of patterns) {
    const match = ua.match(pattern.regex);
    if (match) {
      return { name: pattern.name, version: match[1] || '' };
    }
  }

  return { name: 'Bilinmiyor', version: '' };
}

function detectOs(userAgent, headers) {
  const ua = String(userAgent || '');
  const platformHeader = String(headers['sec-ch-ua-platform'] || '').replace(/"/g, '');
  if (!ua && !platformHeader) {
    return { name: 'OS bilgisi yok', version: '' };
  }

  if (/Windows NT 10\.0/.test(ua)) return { name: 'Windows', version: '10/11' };
  if (/Windows NT 6\.3/.test(ua)) return { name: 'Windows', version: '8.1' };
  if (/Windows NT 6\.2/.test(ua)) return { name: 'Windows', version: '8' };
  if (/Windows NT 6\.1/.test(ua)) return { name: 'Windows', version: '7' };
  if (/Android ([\d.]+)/.test(ua)) return { name: 'Android', version: ua.match(/Android ([\d.]+)/)[1] || '' };
  if (/iPhone OS ([\d_]+)/.test(ua)) return { name: 'iOS', version: (ua.match(/iPhone OS ([\d_]+)/)[1] || '').replace(/_/g, '.') };
  if (/iPad; CPU OS ([\d_]+)/.test(ua)) return { name: 'iPadOS', version: (ua.match(/CPU OS ([\d_]+)/)[1] || '').replace(/_/g, '.') };
  if (/Mac OS X ([\d_]+)/.test(ua)) return { name: 'macOS', version: (ua.match(/Mac OS X ([\d_]+)/)[1] || '').replace(/_/g, '.') };
  if (/Linux/.test(ua)) return { name: 'Linux', version: '' };
  if (platformHeader) return { name: platformHeader, version: '' };
  return { name: 'Bilinmiyor', version: '' };
}

function detectDevice(userAgent, headers) {
  const ua = String(userAgent || '');
  const modelHeader = String(headers['sec-ch-ua-model'] || '').replace(/"/g, '');
  const mobileHeader = String(headers['sec-ch-ua-mobile'] || '').replace(/"/g, '');

  let type = 'desktop';
  if (/iPad|Tablet/.test(ua)) {
    type = 'tablet';
  } else if (/Mobile|Android|iPhone/.test(ua) || mobileHeader === '?1') {
    type = 'mobile';
  } else if (!ua && !modelHeader) {
    type = 'cihaz bilgisi yok';
  }

  return {
    type,
    vendor: '',
    model: modelHeader || ''
  };
}

function collectRequestContext(req) {
  const userAgent = req.get('user-agent') || '';
  const ip = resolveClientIp(req);
  const browser = detectBrowser(userAgent, req.headers);
  const os = detectOs(userAgent, req.headers);
  const device = detectDevice(userAgent, req.headers);

  return {
    ipAddress: ip.ipAddress,
    ipChain: ip.ipChain,
    userAgent,
    browserName: browser.name,
    browserVersion: browser.version,
    osName: os.name,
    osVersion: os.version,
    deviceType: device.type,
    deviceVendor: device.vendor,
    deviceModel: device.model,
    acceptLanguage: req.get('accept-language') || '',
    requestHeaders: {
      'x-forwarded-for': req.get('x-forwarded-for') || '',
      'x-real-ip': req.get('x-real-ip') || '',
      'user-agent': userAgent,
      'accept-language': req.get('accept-language') || '',
      'sec-ch-ua': req.get('sec-ch-ua') || '',
      'sec-ch-ua-platform': req.get('sec-ch-ua-platform') || '',
      'sec-ch-ua-mobile': req.get('sec-ch-ua-mobile') || '',
      'sec-ch-ua-model': req.get('sec-ch-ua-model') || ''
    }
  };
}

module.exports = {
  collectRequestContext,
  normalizeIp,
  resolveClientIp
};
