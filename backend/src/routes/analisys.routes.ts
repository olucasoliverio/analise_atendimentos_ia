import { Router } from 'express';
import { AnalysisController } from '../controllers/analisys.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validateRequest';
import { z } from 'zod';

const router = Router();
const controller = new AnalysisController();

// ✅ Schemas de validação
const createAnalysisSchema = z.object({
  conversationIds: z.array(z.string()).min(1, 'Forneça pelo menos um ID de conversa')
});

const createBatchSchema = z.object({
  conversationIds: z.array(z.string())
    .min(2, 'Análise em lote requer pelo menos 2 conversas')
    .max(50, 'Máximo de 50 conversas por lote')
});

// Aplicar autenticação em todas as rotas
router.use(authMiddleware);

// ✅ Rotas de análise
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

// ✅ NOVO - Rotas de cache
router.get('/cache/stats', (req, res, next) => 
  controller.getCacheStats(req, res, next)
);

router.post('/cache/clean', (req, res, next) => 
  controller.cleanCache(req, res, next)
);

export default router;