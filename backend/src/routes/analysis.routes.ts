import { Router } from 'express';
import { z } from 'zod';
import { AnalysisController } from '../controllers/analysis.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();
const controller = new AnalysisController();
const maxConversationsPerJob = Number(process.env.ANALYSIS_MAX_CONVERSATIONS_PER_JOB || 10);

const createAnalysisSchema = z.object({
  conversationIds: z.array(z.string().trim().min(1, 'ID de conversa invalido'))
    .min(1, 'Forneca pelo menos um ID de conversa')
    .max(maxConversationsPerJob, `Maximo de ${maxConversationsPerJob} conversas por analise`)
});

const createBatchSchema = z.object({
  conversationIds: z.array(z.string())
    .min(2, 'Analise em lote requer pelo menos 2 conversas')
    .max(50, 'Maximo de 50 conversas por lote')
});

router.use(authMiddleware);

router.post('/', validateRequest(createAnalysisSchema), (req, res, next) =>
  controller.create(req as any, res, next)
);

router.post('/batch', validateRequest(createBatchSchema), (req, res, next) =>
  controller.createBatch(req as any, res, next)
);

router.get('/jobs/:jobId', (req, res, next) =>
  controller.getJobStatus(req as any, res, next)
);

router.get('/', (req, res, next) =>
  controller.list(req as any, res, next)
);

router.get('/:id', (req, res, next) =>
  controller.getById(req as any, res, next)
);

router.delete('/:id', (req, res, next) =>
  controller.delete(req as any, res, next)
);

router.delete('/:id/reanalyze', (req, res, next) =>
  controller.reanalyze(req as any, res, next)
);

router.get('/cache/stats', (req, res, next) =>
  controller.getCacheStats(req, res, next)
);

router.post('/cache/clean', (req, res, next) =>
  controller.cleanCache(req, res, next)
);

export default router;

