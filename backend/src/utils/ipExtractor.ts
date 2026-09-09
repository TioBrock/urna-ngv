import { Request } from 'express';

/**
 * Extrai o IP real do cliente, considerando proxies/load balancers.
 * Respeita X-Forwarded-For quando configurado com trust proxy.
 */
export function extractIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return ips.split(',')[0].trim();
  }
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}
