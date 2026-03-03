// ==========================================
// src/services/freshchat-cache.service.ts
// ✅ CACHE INTELIGENTE - VERSÃO CORRIGIDA
// ==========================================

import { prisma } from '../config/database';
import { FreshchatService } from './freshchat.service';

export class FreshchatCacheService {
  private freshchatService: FreshchatService;
  private readonly PRISMA_BATCH_SIZE = 3;
  
  // Configurações de TTL (Time To Live)
  private readonly AGENT_CACHE_TTL = 1000 * 60 * 60 * 24 * 7; // 7 dias
  private readonly CUSTOMER_CACHE_TTL = 1000 * 60 * 60 * 24 * 7; // 7 dias
  private readonly CONVERSATION_CACHE_TTL = 1000 * 60 * 60 * 24; // 1 dia
  private readonly MESSAGES_CACHE_TTL = 1000 * 60 * 60 * 24; // 1 dia

  constructor() {
    this.freshchatService = new FreshchatService();
  }

  // ==========================================
  // CACHE DE AGENTES
  // ==========================================

  async getAgent(agentId: string) {
    const cached = await prisma.agent.findUnique({
      where: { id: agentId }
    });

    if (cached && this.isAgentCacheFresh(cached)) {
      console.log(`💾 Cache DB hit: agente ${agentId}`);
      
      await prisma.agent.update({
        where: { id: agentId },
        data: { fetchCount: { increment: 1 } }
      });

      return {
        id: cached.id,
        first_name: cached.firstName,
        last_name: cached.lastName,
        email: cached.email,
        displayName: cached.displayName
      };
    }

    console.log(`🌐 Cache DB miss: buscando agente ${agentId} da API`);
    
    const agentData = await this.freshchatService.getAgent(agentId);
    
    if (!agentData) return null;

    const agent = await prisma.agent.upsert({
      where: { id: agentId },
      update: {
        firstName: agentData.first_name || '',
        lastName: agentData.last_name || '',
        displayName: `${agentData.first_name} ${agentData.last_name}`.trim(),
        lastFetchedAt: new Date(),
        fetchCount: { increment: 1 }
      },
      create: {
        id: agentId,
        firstName: agentData.first_name || '',
        lastName: agentData.last_name || '',
        displayName: `${agentData.first_name} ${agentData.last_name}`.trim(),
        email: agentData.email,
        active: true,
        fetchCount: 1
      }
    });

    return {
      id: agent.id,
      first_name: agent.firstName,
      last_name: agent.lastName,
      email: agent.email,
      displayName: agent.displayName
    };
  }

  async getMultipleAgents(agentIds: string[]) {
    const uniqueIds = [...new Set(agentIds)];
    
    const cached = await prisma.agent.findMany({
      where: {
        id: { in: uniqueIds },
        lastFetchedAt: {
          gte: new Date(Date.now() - this.AGENT_CACHE_TTL)
        }
      }
    });

    const cachedMap = new Map(cached.map(a => [a.id, a]));
    const missingIds = uniqueIds.filter(id => !cachedMap.has(id));

    console.log(`💾 Agentes do cache: ${cached.length}`);
    console.log(`🌐 Agentes a buscar: ${missingIds.length}`);

    if (missingIds.length > 0) {
      await this.runInBatches(
        missingIds,
        this.PRISMA_BATCH_SIZE,
        async (id) => this.getAgent(id)
      );
      
      const newCached = await prisma.agent.findMany({
        where: { id: { in: missingIds } }
      });
      
      newCached.forEach(a => cachedMap.set(a.id, a));
    }

    const result = new Map();
    uniqueIds.forEach(id => {
      const agent = cachedMap.get(id);
      if (agent) {
        result.set(id, agent.displayName);
      }
    });

    return result;
  }

  // ==========================================
  // CACHE DE CLIENTES - ✅ CORRIGIDO
  // ==========================================

  /**
   * ✅ CORRIGIDO - Usar apenas ID como chave única
   */
  async cacheCustomer(customerId: string, customerData: any) {
    if (!customerId?.trim()) {
      throw new Error('Conversa sem customerId retornado pelo Freshchat');
    }

    try {
      await prisma.customer.upsert({
        where: { id: customerId },
        update: {
          email: customerData.email || null,
          firstName: customerData.first_name || null,
          lastName: customerData.last_name || null,
          displayName: customerData.name || `${customerData.first_name || ''} ${customerData.last_name || ''}`.trim() || null,
          phone: customerData.phone || null,
          lastFetchedAt: new Date(),
          fetchCount: { increment: 1 }
        },
        create: {
          id: customerId,
          email: customerData.email || null,
          firstName: customerData.first_name || null,
          lastName: customerData.last_name || null,
          displayName: customerData.name || `${customerData.first_name || ''} ${customerData.last_name || ''}`.trim() || null,
          phone: customerData.phone || null,
          fetchCount: 1
        }
      });
    } catch (error: any) {
      // Se falhar por qualquer motivo, apenas logar e continuar
      console.warn(`⚠️ Erro ao cachear cliente ${customerId}:`, error.message);
    }
  }

  // ==========================================
  // CACHE DE CONVERSAS
  // ==========================================

  async getConversation(conversationId: string, forceRefresh = false) {
    if (!forceRefresh) {
      const cached = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          customer: true,
          assignedAgent: true
        }
      });

      const hasCustomerInfo =
        !!cached?.customerName ||
        !!cached?.customerEmail ||
        !!cached?.customer?.displayName ||
        !!cached?.customer?.email;

      if (cached && this.isConversationCacheFresh(cached) && hasCustomerInfo) {
        console.log(`💾 Cache DB hit: conversa ${conversationId}`);
        return this.formatConversation(cached);
      }
    }

    console.log(`🌐 Buscando conversa ${conversationId} da API`);
    const convData = await this.freshchatService.getConversationByAnyId(conversationId);

    if (!convData.customerId?.trim()) {
      throw new Error(`Conversa ${conversationId} sem customerId retornado pelo Freshchat`);
    }

    // ✅ Cache do cliente (com try-catch)
    await this.cacheCustomer(convData.customerId, {
      id: convData.customerId,
      email: convData.customerEmail,
      name: convData.customerName,
      first_name: convData.customerName?.split(' ')[0],
      last_name: convData.customerName?.split(' ').slice(1).join(' ')
    });

    // Cache do agente
    if (convData.assignedAgentId) {
      await this.getAgent(convData.assignedAgentId);
    }

    // Salvar conversa no banco
    const conversation = await prisma.conversation.upsert({
      where: { id: conversationId },
      update: {
        customerId: convData.customerId,
        customerName: convData.customerName,
        customerEmail: convData.customerEmail,
        assignedAgentId: convData.assignedAgentId || null,
        assignedAgentName: convData.assignedAgentName,
        status: convData.status,
        updatedAt: new Date(convData.updatedAt),
        lastFetchedAt: new Date()
      },
      create: {
        id: conversationId,
        customerId: convData.customerId,
        customerName: convData.customerName,
        customerEmail: convData.customerEmail,
        assignedAgentId: convData.assignedAgentId || null,
        assignedAgentName: convData.assignedAgentName,
        status: convData.status,
        createdAt: new Date(convData.createdAt),
        updatedAt: new Date(convData.updatedAt)
      },
      include: {
        customer: true,
        assignedAgent: true
      }
    });

    return this.formatConversation(conversation);
  }

  // ==========================================
  // CACHE DE MENSAGENS
  // ==========================================

  async getMessages(conversationId: string, forceRefresh = false) {
    if (!forceRefresh) {
      const cached = await prisma.message.findMany({
        where: {
          conversationId,
          lastFetchedAt: {
            gte: new Date(Date.now() - this.MESSAGES_CACHE_TTL)
          }
        },
        orderBy: { createdAt: 'asc' }
      });

      if (cached.length > 0) {
        console.log(`💾 Cache DB hit: ${cached.length} mensagens de ${conversationId}`);
        return cached.map(m => this.formatMessage(m));
      }
    }

    console.log(`🌐 Buscando mensagens de ${conversationId} da API`);
    const messages = await this.freshchatService.getMessages(conversationId);

    const agentIds = [...new Set(
      messages
        .filter(m => m.actorType === 'AGENT' && m.actorId)
        .map(m => m.actorId!)
    )];

    const agentsMap = await this.getMultipleAgents(agentIds);

    // Limita o número de upserts simultâneos para não esgotar o pool do Prisma.
    await this.runInBatches(
      messages,
      this.PRISMA_BATCH_SIZE,
      async (msg) => {
        try {
          const actorName = msg.actorType === 'AGENT' && msg.actorId
            ? agentsMap.get(msg.actorId) || 'Agente'
            : msg.actorName;

          await prisma.message.upsert({
            where: { freshchatMessageId: msg.id },
            update: {
              actorName,
              lastFetchedAt: new Date()
            },
            create: {
              conversationId,
              freshchatMessageId: msg.id,
              messageType: msg.messageType,
              actorType: msg.actorType,
              actorId: msg.actorId,
              actorName,
              content: msg.content,
              hasMedia: msg.hasMedia,
              mediaUrls: msg.mediaUrls,
              isImportantNote: msg.isImportantNote,
              createdAt: new Date(msg.createdAt)
            }
          });
        } catch (error: any) {
          console.warn(`⚠️ Erro ao salvar mensagem ${msg.id}:`, error.message);
        }
      }
    );

    // Atualizar estatísticas da conversa
    await this.updateConversationStats(conversationId, messages);

    return messages.map(m => ({
      ...m,
      actorName: m.actorType === 'AGENT' && m.actorId
        ? agentsMap.get(m.actorId) || 'Agente'
        : m.actorName
    }));
  }

  // ==========================================
  // HELPERS
  // ==========================================

  private isAgentCacheFresh(agent: any): boolean {
    const age = Date.now() - agent.lastFetchedAt.getTime();
    return age < this.AGENT_CACHE_TTL;
  }

  private isConversationCacheFresh(conversation: any): boolean {
    const age = Date.now() - conversation.lastFetchedAt.getTime();
    return age < this.CONVERSATION_CACHE_TTL;
  }

  private formatConversation(conv: any) {
    return {
      id: conv.id,
      customerId: conv.customerId,
      customerName:
        conv.customerName ||
        conv.customer?.displayName ||
        conv.customer?.firstName ||
        conv.customer?.email,
      customerEmail: conv.customerEmail || conv.customer?.email,
      assignedAgentId: conv.assignedAgentId,
      assignedAgentName: conv.assignedAgentName || conv.assignedAgent?.displayName,
      status: conv.status,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString()
    };
  }

  private formatMessage(msg: any) {
    return {
      id: msg.freshchatMessageId,
      messageType: msg.messageType,
      actorType: msg.actorType,
      actorId: msg.actorId,
      actorName: msg.actorName,
      content: msg.content,
      hasMedia: msg.hasMedia,
      mediaUrls: msg.mediaUrls,
      isImportantNote: msg.isImportantNote,
      createdAt: msg.createdAt.toISOString()
    };
  }

  private async updateConversationStats(conversationId: string, messages: any[]) {
    try {
      const stats = {
        messageCount: messages.length,
        customerMessageCount: messages.filter(m => m.actorType === 'USER').length,
        agentMessageCount: messages.filter(m => m.actorType === 'AGENT').length,
        averageResponseTime: this.calculateAverageResponseTime(messages)
      };

      await prisma.conversation.update({
        where: { id: conversationId },
        data: stats
      });
    } catch (error: any) {
      console.warn(`⚠️ Erro ao atualizar stats de ${conversationId}:`, error.message);
    }
  }

  private calculateAverageResponseTime(messages: any[]): number | null {
    const responseTimes: number[] = [];
    let lastUserMessageTime: Date | null = null;

    messages.forEach(msg => {
      const msgTime = new Date(msg.createdAt);

      if (msg.actorType === 'USER') {
        lastUserMessageTime = msgTime;
      } else if (msg.actorType === 'AGENT' && lastUserMessageTime) {
        const responseTime = (msgTime.getTime() - lastUserMessageTime.getTime()) / 1000;
        if (responseTime > 0 && responseTime < 3600) {
          responseTimes.push(responseTime);
        }
        lastUserMessageTime = null;
      }
    });

    if (responseTimes.length === 0) return null;
    
    const average = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    return Math.round(average);
  }

  private async runInBatches<T>(
    items: T[],
    batchSize: number,
    handler: (item: T) => Promise<unknown>
  ) {
    for (let index = 0; index < items.length; index += batchSize) {
      const batch = items.slice(index, index + batchSize);
      await Promise.all(batch.map(handler));
    }
  }

  // ==========================================
  // UTILIDADES
  // ==========================================

  async cleanExpiredCache() {
    const now = new Date();

    const [agents, customers, conversations, messages] = await Promise.all([
      prisma.agent.deleteMany({
        where: {
          lastFetchedAt: {
            lt: new Date(now.getTime() - this.AGENT_CACHE_TTL)
          }
        }
      }),
      prisma.customer.deleteMany({
        where: {
          lastFetchedAt: {
            lt: new Date(now.getTime() - this.CUSTOMER_CACHE_TTL)
          }
        }
      }),
      prisma.conversation.deleteMany({
        where: {
          lastFetchedAt: {
            lt: new Date(now.getTime() - this.CONVERSATION_CACHE_TTL)
          }
        }
      }),
      prisma.message.deleteMany({
        where: {
          lastFetchedAt: {
            lt: new Date(now.getTime() - this.MESSAGES_CACHE_TTL)
          }
        }
      })
    ]);

    console.log('🧹 Cache limpo:', {
      agents: agents.count,
      customers: customers.count,
      conversations: conversations.count,
      messages: messages.count
    });
  }

  async getCacheStats() {
    const [agents, customers, conversations, messages] = await Promise.all([
      prisma.agent.count(),
      prisma.customer.count(),
      prisma.conversation.count(),
      prisma.message.count()
    ]);

    return {
      agents,
      customers,
      conversations,
      messages,
      totalRecords: agents + customers + conversations + messages
    };
  }
}
