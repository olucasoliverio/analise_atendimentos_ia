import { Router } from 'express';
import authRoutes from './auth.routes';
import conversationRoutes from './conversation.routes';
import analysisRoutes from './analisys.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/conversations', conversationRoutes);
router.use('/analyses', analysisRoutes);

export default router;