import { NextFunction, Request, Response } from 'express';
import { FreshchatService } from '../services/freshchat.service';
import { catchAsync } from '../utils/catchAsync';

const freshchatService = new FreshchatService();

export class ConversationController {
  getById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const conversation = await freshchatService.getConversationByAnyId(id);
    conversation.messages = await freshchatService.getMessages(conversation.id);

    res.json(conversation);
  });

  getMultiple = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        message: 'Forneca um array de IDs de conversas'
      });
    }

    const conversations = await freshchatService.getMultipleConversationsByAnyId(ids);

    if (conversations.length === 0) {
      return res.status(404).json({
        message: 'Nenhuma conversa encontrada para os IDs fornecidos',
        idsSearched: ids
      });
    }

    res.json(conversations);
  });

  getByEmail = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { email } = req.params;
    const userIds = await freshchatService.getUserIdsByEmail(email);

    if (userIds.length === 0) {
      return res.status(404).json({
        message: `Nenhum cliente encontrado com o email: ${email}`
      });
    }

    let allConversationIds: string[] = [];

    for (const userId of userIds) {
      try {
        const conversationIds = await freshchatService.getConversationsByUserId(userId);
        allConversationIds = allConversationIds.concat(conversationIds);
      } catch (error: any) {
        console.warn('Falha ao buscar conversas para um usuario do Freshchat:', error.message);
      }
    }

    allConversationIds = [...new Set(allConversationIds)];

    if (allConversationIds.length === 0) {
      return res.json([]);
    }

    const conversations = await freshchatService.getMultipleConversationsByAnyId(allConversationIds);
    res.json(conversations);
  });

  getByCustomer = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { customerId } = req.params;
    const conversationIds = await freshchatService.getConversationsByCustomer(customerId);
    const conversations = await freshchatService.getMultipleConversations(conversationIds);
    res.json(conversations);
  });
}
