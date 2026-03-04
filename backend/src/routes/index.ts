import { Router } from 'express';
import conversationRoutes from './conversation.routes';
import analysisRoutes from './analisys.routes';

const router = Router();

router.use('/conversations', conversationRoutes);
router.use('/analyses', analysisRoutes);

export default router;