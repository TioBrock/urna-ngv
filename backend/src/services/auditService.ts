import { AuditEventType } from '@prisma/client';
import { prisma } from '../utils/prisma';

interface AuditLogEntry {
  eventType: AuditEventType;
  description: string;
  electionId?: string;
  adminUserId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

export const auditService = {
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await prisma.auditLog.create({ data: entry as any });
    } catch (err) {
      // Auditoria nunca deve derrubar a operação principal
      console.error('❌ Falha ao registrar evento de auditoria:', err);
    }
  },
};
