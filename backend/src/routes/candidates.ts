import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';

// Carregamento defensivo do sharp (opcional para redimensionamento de fotos)
let sharp: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  sharp = require('sharp');
} catch {
  // Fallback se libvips não estiver disponível no sistema
}
import { prisma } from '../utils/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { auditService } from '../services/auditService';
import { AppError } from '../middleware/errorHandler';

export const candidatesRouter = Router();

const uploadDir = process.env.UPLOAD_DIR ?? './uploads';

// Configurar multer para upload de fotos
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      cb(err as Error, uploadDir);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB ?? '5') * 1024 * 1024) },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new AppError('Formato de imagem não suportado. Use JPG, PNG, WebP ou GIF.', 400));
    }
  },
});

const booleanField = z.preprocess((val) => {
  if (typeof val === 'string') return val === 'true' || val === '1';
  return Boolean(val);
}, z.boolean());

const candidateSchema = z.object({
  electionId: z.string().uuid(),
  positionId: z.string().uuid(),
  stateId: z.string().uuid().optional().nullable().or(z.literal('')),
  name: z.string().min(1, 'Nome é obrigatório'),
  electoralName: z.string().min(1, 'Nome eleitoral é obrigatório'),
  number: z.string().min(1, 'Número é obrigatório'),
  party: z.string().min(1, 'Partido é obrigatório'),
  viceCandidateName: z.string().optional().nullable(),
  isNational: booleanField.default(false),
  isActive: booleanField.default(true),
});

// GET /api/candidates — lista com filtros
candidatesRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { electionId, positionId, stateId, search } = req.query;

  const candidates = await prisma.candidate.findMany({
    where: {
      ...(electionId ? { electionId: String(electionId) } : {}),
      ...(positionId ? { positionId: String(positionId) } : {}),
      ...(stateId ? { stateId: String(stateId) } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: String(search), mode: 'insensitive' } },
              { electoralName: { contains: String(search), mode: 'insensitive' } },
              { number: { contains: String(search) } },
            ],
          }
        : {}),
    },
    include: {
      position: { select: { id: true, name: true } },
      state: { select: { id: true, name: true, abbreviation: true } },
    },
    orderBy: [{ position: { name: 'asc' } }, { number: 'asc' }],
  });

  res.json(candidates);
});

// GET /api/candidates/:id
candidatesRouter.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const candidate = await prisma.candidate.findUnique({
    where: { id: req.params.id },
    include: {
      position: true,
      state: true,
      election: { select: { id: true, name: true } },
    },
  });

  if (!candidate) {
    res.status(404).json({ error: 'Candidato não encontrado' });
    return;
  }

  res.json(candidate);
});

// POST /api/candidates — com upload de foto
candidatesRouter.post(
  '/',
  requireAuth,
  upload.single('photo') as any,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const result = candidateSchema.safeParse(req.body);
    if (!result.success) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      res.status(400).json({ error: result.error.errors[0].message });
      return;
    }

    let photoUrl: string | undefined;
    if (req.file) {
      if (sharp) {
        try {
          const optimizedPath = path.join(uploadDir, `opt_${req.file.filename}.webp`);
          await sharp(req.file.path).resize(400, 400, { fit: 'cover' }).webp({ quality: 85 }).toFile(optimizedPath);
          await fs.unlink(req.file.path).catch(() => {});
          photoUrl = `/uploads/${path.basename(optimizedPath)}`;
        } catch {
          photoUrl = `/uploads/${req.file.filename}`;
        }
      } else {
        photoUrl = `/uploads/${req.file.filename}`;
      }
    }

    const position = await prisma.position.findUnique({ where: { id: result.data.positionId } });
    if (!position) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      res.status(404).json({ error: 'Cargo selecionado não encontrado' });
      return;
    }
    const isPositionNational =
      position.scope === 'NACIONAL' ||
      position.isNational ||
      ['Presidente', 'Vice-Presidente'].includes(position.name ?? '');

    const rawStateId = result.data.stateId;
    const stateId = rawStateId && rawStateId.trim() !== '' ? rawStateId : null;
    // Candidaturas a cargos nacionais são SEMPRE nacionais (votáveis em todos os estados)
    const isNational = isPositionNational ? true : (stateId ? false : (result.data.isNational ?? false));

    const candidate = await prisma.candidate.create({
      data: {
        ...result.data,
        stateId,
        isNational,
        photoUrl,
      },
      include: { position: true, state: true },
    });

    await auditService.log({
      eventType: 'CANDIDATE_CREATED',
      description: `Candidato "${candidate.electoralName}" (${candidate.number}) criado`,
      electionId: candidate.electionId,
      adminUserId: req.adminUser!.id,
      metadata: { candidateId: candidate.id, positionId: candidate.positionId },
    });

    res.status(201).json(candidate);
  }
);

// PUT /api/candidates/:id — com upload opcional de foto
candidatesRouter.put(
  '/:id',
  requireAuth,
  upload.single('photo') as any,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const result = candidateSchema.partial().safeParse(req.body);
    if (!result.success) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      res.status(400).json({ error: result.error.errors[0].message });
      return;
    }

    const existing = await prisma.candidate.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      res.status(404).json({ error: 'Candidato não encontrado' });
      return;
    }

    let photoUrl = existing.photoUrl;
    if (req.file) {
      if (sharp) {
        try {
          const optimizedPath = path.join(uploadDir, `opt_${req.file.filename}.webp`);
          await sharp(req.file.path).resize(400, 400, { fit: 'cover' }).webp({ quality: 85 }).toFile(optimizedPath);
          await fs.unlink(req.file.path).catch(() => {});
          photoUrl = `/uploads/${path.basename(optimizedPath)}`;
        } catch {
          photoUrl = `/uploads/${req.file.filename}`;
        }
      } else {
        photoUrl = `/uploads/${req.file.filename}`;
      }

      // Remover foto antiga
      if (existing.photoUrl) {
        const oldPath = path.join(process.cwd(), existing.photoUrl);
        await fs.unlink(oldPath).catch(() => {});
      }
    }

    const targetPositionId = result.data.positionId ?? existing.positionId;
    const position = await prisma.position.findUnique({ where: { id: targetPositionId } });
    const isPositionNational =
      position?.scope === 'NACIONAL' ||
      position?.isNational ||
      ['Presidente', 'Vice-Presidente'].includes(position?.name ?? '');

    const rawStateId = result.data.stateId;
    let stateId: string | null | undefined = undefined;
    let isNational: boolean | undefined = isPositionNational ? true : result.data.isNational;

    if (rawStateId !== undefined) {
      stateId = rawStateId && rawStateId.trim() !== '' ? rawStateId : null;
      isNational = isPositionNational ? true : (stateId ? false : true);
    }

    const updated = await prisma.candidate.update({
      where: { id: req.params.id },
      data: {
        ...result.data,
        ...(stateId !== undefined ? { stateId } : {}),
        ...(isNational !== undefined ? { isNational } : {}),
        photoUrl,
      },
      include: { position: true, state: true },
    });

    await auditService.log({
      eventType: 'CANDIDATE_UPDATED',
      description: `Candidato "${updated.electoralName}" atualizado`,
      electionId: updated.electionId,
      adminUserId: req.adminUser!.id,
    });

    res.json(updated);
  }
);

// DELETE /api/candidates/:id
candidatesRouter.delete('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const existing = await prisma.candidate.findUnique({
    where: { id: req.params.id },
    include: { election: true },
  });
  if (!existing) {
    res.status(404).json({ error: 'Candidato não encontrado' });
    return;
  }
  if (existing.election.status === 'OPEN') {
    res.status(409).json({ error: 'Não é possível remover candidatos de uma eleição aberta' });
    return;
  }

  if (existing.photoUrl) {
    const oldPath = path.join(process.cwd(), existing.photoUrl);
    await fs.unlink(oldPath).catch(() => {});
  }

  await prisma.candidate.delete({ where: { id: req.params.id } });

  await auditService.log({
    eventType: 'CANDIDATE_DELETED',
    description: `Candidato "${existing.electoralName}" removido`,
    electionId: existing.electionId,
    adminUserId: req.adminUser!.id,
  });

  res.json({ message: 'Candidato removido com sucesso' });
});
