// ================================================
// src/controllers/conversation.controller.ts
// ================================================
import { Request, Response, NextFunction } from 'express';
import { FreshchatService } from '../services/freshchat.service';
import { catchAsync } from '../utils/catchAsync';

const freshchatService = new FreshchatService();

export class ConversationController {
  getById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    console.log('📥 getById called with:', id);

    // Aceita tanto UUID quanto ID numérico
    const conversation = await freshchatService.getConversationByAnyId(id);
    conversation.messages = await freshchatService.getMessages(conversation.id);

    res.json(conversation);
  });

  getMultiple = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { ids } = req.body;
    console.log('📥 [Controller] getMultiple chamado com IDs:', JSON.stringify(ids));

    if (!Array.isArray(ids) || ids.length === 0) {
      console.warn('⚠️ [Controller] Nenhum ID fornecido no corpo da requisição');
      return res.status(400).json({
        message: 'Forneça um array de IDs de conversas'
      });
    }

    // Aceita IDs numéricos ou UUIDs
    const conversations = await freshchatService.getMultipleConversationsByAnyId(ids);

    console.log(`✅ [Controller] ${conversations.length} conversas encontradas na API`);

    if (conversations.length === 0) {
      console.log('❌ [Controller] Nenhuma conversa encontrada para os IDs:', ids);
      return res.status(404).json({
        message: 'Nenhuma conversa encontrada para os IDs fornecidos',
        idsSearched: ids
      });
    }

    res.json(conversations);
  });

  getByEmail = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { email } = req.params;
    console.log('📧 [Controller] Buscando conversas por email:', email);

    // 1. Buscar TODOS os userIds pelo email
    const userIds = await freshchatService.getUserIdsByEmail(email);

    if (userIds.length === 0) {
      return res.status(404).json({
        message: `Nenhum cliente encontrado com o email: ${email}`
      });
    }

    console.log(`✅ [Controller] ${userIds.length} usuário(s) encontrado(s):`, userIds);

    // 2. Buscar conversas de CADA usuário
    let allConversationIds: string[] = [];

    for (const userId of userIds) {
      try {
        const conversationIds = await freshchatService.getConversationsByUserId(userId);
        allConversationIds = allConversationIds.concat(conversationIds);
      } catch (error: any) {
        console.warn(`⚠️ Erro ao buscar conversas do usuário ${userId}:`, error.message);
      }
    }

    // Remover duplicatas (caso existam)
    allConversationIds = [...new Set(allConversationIds)];

    console.log(`✅ [Controller] Total de ${allConversationIds.length} conversas encontradas`);

    if (allConversationIds.length === 0) {
      return res.json([]);
    }

    // 3. Buscar detalhes de cada conversa
    const conversations = await freshchatService.getMultipleConversationsByAnyId(allConversationIds);
    console.log(`✅ [Controller] ${conversations.length} conversas retornadas`);

    res.json(conversations);
  });

  getByCustomer = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { customerId } = req.params;
    const conversationIds = await freshchatService.getConversationsByCustomer(customerId);
    const conversations = await freshchatService.getMultipleConversations(conversationIds);
    res.json(conversations);
  });
}
