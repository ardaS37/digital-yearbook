function safeRedirectPath(value, fallback = '/', allowedHosts = []) {
  const raw = String(value || '').trim();
  if (!raw || /[\u0000-\u001f\u007f\\]/.test(raw)) {
    return fallback;
  }

  if (raw.startsWith('/') && !raw.startsWith('//')) {
    return raw;
  }

  try {
    const parsed = new URL(raw);
    const allowed = allowedHosts.map((host) => String(host).toLowerCase());
    if (parsed.protocol === 'https:' && allowed.includes(parsed.hostname.toLowerCase())) {
      return parsed.pathname + parsed.search + parsed.hash;
    }
  } catch (error) {
    return fallback;
  }

  return fallback;
}

module.exports = {
  safeRedirectPath
};
