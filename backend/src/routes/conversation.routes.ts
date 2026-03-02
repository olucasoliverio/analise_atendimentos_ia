import { Router } from 'express';
import { ConversationController } from '../controllers/conversation.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const controller = new ConversationController();

router.use(authMiddleware);

router.get('/by-email/:email', (req, res, next) => controller.getByEmail(req, res, next));
router.get('/customer/:customerId', (req, res, next) => controller.getByCustomer(req, res, next));
router.post('/multiple', (req, res, next) => controller.getMultiple(req, res, next));
router.get('/:id', (req, res, next) => controller.getById(req, res, next)); // ← por último!

export default router;