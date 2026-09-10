import 'dotenv/config';
import express from 'express';
import 'express-async-errors'; // captura throws em handlers async automaticamente
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { rateLimit } from 'express-rate-limit';

import { authRouter } from './routes/auth';
import { electionsRouter } from './routes/elections';
import { positionsRouter } from './routes/positions';
import { statesRouter } from './routes/states';
import { candidatesRouter } from './routes/candidates';
import { votingRouter } from './routes/voting';
import { votersRouter } from './routes/voters';
import { resultsRouter } from './routes/results';
import { auditRouter } from './routes/audit';
import { dashboardRouter } from './routes/dashboard';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT ?? 3001;

// ── Security ──
app.set('trust proxy', 1);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ── CORS ──
app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Rate limiting ──
const isDev = process.env.NODE_ENV !== 'production';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: isDev ? 50000 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
  message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' },
});

const votingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: isDev ? 10000 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições de votação. Aguarde um momento.' },
});

app.use('/api', apiLimiter as any);
app.use('/api/voting', votingLimiter as any);

// ── Body parsing ──
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ── Static files (fotos de candidatos) ──
import fs from 'fs';
const uploadDir = process.env.UPLOAD_DIR ?? './uploads';
try {
  fs.mkdirSync(path.resolve(uploadDir), { recursive: true });
} catch {
  // Ignora se já existir
}
app.use('/uploads', express.static(path.resolve(uploadDir)));

// ── Routes ──
app.use('/api/auth', authRouter);
app.use('/api/elections', electionsRouter);
app.use('/api/positions', positionsRouter);
app.use('/api/states', statesRouter);
app.use('/api/candidates', candidatesRouter);
app.use('/api/voting', votingRouter);
app.use('/api/voters', votersRouter);
app.use('/api/results', resultsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/dashboard', dashboardRouter);

// ── Health check ──
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 404 ──
app.use('*', (_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// ── Error handler ──
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV ?? 'development'}`);
});

// ── Proteção global: impede o processo de morrer por erros não capturados ──
process.on('uncaughtException', (err) => {
  console.error('❌ uncaughtException (processo mantido vivo):', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ unhandledRejection (processo mantido vivo):', reason);
});

export default app;
