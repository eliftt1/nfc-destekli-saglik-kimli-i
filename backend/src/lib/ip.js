/** Veri minimizasyonu: IPv4 için /24, IPv6 için /48 öneki saklanır. */
export function truncateIp(ip) {
  if (!ip) return null;
  const clean = ip.replace(/^::ffff:/, '');
  if (clean.includes('.')) {
    const parts = clean.split('.');
    return parts.length === 4 ? `${parts.slice(0, 3).join('.')}.0/24` : null;
  }
  if (clean.includes(':')) {
    const parts = clean.split(':').filter(Boolean).slice(0, 3);
    return parts.length ? `${parts.join(':')}::/48` : null;
  }
  return null;
}
