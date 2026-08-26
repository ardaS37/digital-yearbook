function hexToRgb(hex) {
  const normalized = String(hex || '').trim();
  const match = normalized.match(/^#?([0-9a-fA-F]{6})$/);
  if (!match) {
    return null;
  }

  const value = match[1];
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('')}`;
}

function channelToLinear(value) {
  const normalized = value / 255;
  if (normalized <= 0.03928) {
    return normalized / 12.92;
  }
  return ((normalized + 0.055) / 1.055) ** 2.4;
}

function getRelativeLuminance(rgb) {
  return (0.2126 * channelToLinear(rgb.r)) + (0.7152 * channelToLinear(rgb.g)) + (0.0722 * channelToLinear(rgb.b));
}

function rgbToHsl({ r, g, b }) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  if (delta !== 0) {
    if (max === red) {
      hue = 60 * (((green - blue) / delta) % 6);
    } else if (max === green) {
      hue = 60 * ((blue - red) / delta + 2);
    } else {
      hue = 60 * ((red - green) / delta + 4);
    }
  }

  return {
    h: (hue + 360) % 360,
    s: saturation,
    l: lightness
  };
}

function hslToRgb({ h, s, l }) {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const hueSection = h / 60;
  const x = chroma * (1 - Math.abs((hueSection % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;

  if (hueSection >= 0 && hueSection < 1) {
    red = chroma;
    green = x;
  } else if (hueSection < 2) {
    red = x;
    green = chroma;
  } else if (hueSection < 3) {
    green = chroma;
    blue = x;
  } else if (hueSection < 4) {
    green = x;
    blue = chroma;
  } else if (hueSection < 5) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  const match = l - chroma / 2;
  return {
    r: (red + match) * 255,
    g: (green + match) * 255,
    b: (blue + match) * 255
  };
}

function isReadableThemeColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return false;
  }

  const luminance = getRelativeLuminance(rgb);
  return luminance >= 0.08 && luminance <= 0.9;
}

function normalizeThemeColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return null;
  }

  const base = rgbToHsl(rgb);
  return rgbToHex(hslToRgb({
    h: base.h,
    s: Math.max(0.42, Math.min(0.78, base.s || 0.42)),
    l: Math.max(0.28, Math.min(0.62, base.l))
  }));
}

function getReadableTextColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return '#ffffff';
  }

  return getRelativeLuminance(rgb) > 0.45 ? '#102331' : '#ffffff';
}

function buildThemeAccentPair(hex) {
  const normalizedHex = normalizeThemeColor(hex);
  const rgb = hexToRgb(normalizedHex);
  if (!rgb) {
    return null;
  }

  const base = rgbToHsl(rgb);
  const primaryButton = {
    h: base.h,
    s: Math.max(0.5, Math.min(0.82, base.s)),
    l: Math.max(0.24, Math.min(0.42, base.l * 0.78))
  };
  const secondary = {
    h: (base.h + 26) % 360,
    s: Math.max(0.38, Math.min(0.78, base.s * 0.92)),
    l: Math.max(0.34, Math.min(0.52, base.l * 0.88))
  };
  const secondaryButton = {
    h: secondary.h,
    s: Math.max(0.42, Math.min(0.8, secondary.s)),
    l: Math.max(0.24, Math.min(0.4, secondary.l * 0.8))
  };

  const primaryButtonHex = rgbToHex(hslToRgb(primaryButton));
  const secondaryButtonHex = rgbToHex(hslToRgb(secondaryButton));

  return {
    primary: normalizedHex,
    secondary: rgbToHex(hslToRgb(secondary)),
    primaryButton: primaryButtonHex,
    secondaryButton: secondaryButtonHex,
    primaryText: getReadableTextColor(primaryButtonHex),
    secondaryText: getReadableTextColor(secondaryButtonHex)
  };
}

module.exports = {
  buildThemeAccentPair,
  isReadableThemeColor,
  normalizeThemeColor
};
