export function isTrustedOrigin(origin, configuredOrigin) {
  if (!origin || !configuredOrigin) return false;
  try {
    const expected = new URL(configuredOrigin);
    return ['http:', 'https:'].includes(expected.protocol) && expected.origin === configuredOrigin && origin === configuredOrigin;
  } catch { return false; }
}
