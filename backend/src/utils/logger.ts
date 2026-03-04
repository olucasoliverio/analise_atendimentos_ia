const isProduction = process.env.NODE_ENV === 'production';
const verboseLoggingEnabled = process.env.LOG_VERBOSE === 'true';

export const debugLog = (...args: unknown[]) => {
  if (!isProduction || verboseLoggingEnabled) {
    console.log(...args);
  }
};

export const maskEmail = (value?: string | null): string => {
  if (!value) return 'unknown';

  const [localPart, domain] = value.split('@');
  if (!domain) return `${value.slice(0, 2)}***`;

  const localVisible = localPart.slice(0, 2);
  const domainParts = domain.split('.');
  const domainName = domainParts[0] || '';
  const domainSuffix = domainParts.slice(1).join('.');

  return `${localVisible}***@${domainName.slice(0, 2)}***${domainSuffix ? `.${domainSuffix}` : ''}`;
};

export const maskIdentifier = (value?: string | null): string => {
  if (!value) return 'unknown';
  if (value.length <= 6) return `${value.slice(0, 1)}***`;
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
};

export const maskUrl = (value?: string | null): string => {
  if (!value) return 'unknown';

  try {
    const parsed = new URL(value);
    return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`;
  } catch {
    return value.slice(0, 16);
  }
};
