import axios, { AxiosInstance } from 'axios';
import { ConversationDetailDTO, MessageDTO } from '../models/dtos/conversation.dto';

type MessagePaginationMode = 'page_items_per_page' | 'page_per_page' | 'items_per_page' | 'none';

export class FreshchatService {
  private api: AxiosInstance;

  private agentsCache = new Map<string, { first_name: string; last_name: string }>();
  private agentsCacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL = 1000 * 60 * 60; // 1 hora
  private cacheCleanerInterval?: NodeJS.Timeout;

  constructor() {
    this.api = axios.create({
      baseURL: process.env.FRESHCHAT_API_URL,
      headers: {
        'Authorization': `Bearer ${process.env.FRESHCHAT_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      httpsAgent: process.env.NODE_ENV === 'development' ? 
        new (require('https').Agent)({ rejectUnauthorized: false }) : undefined
    });
    
    this.startCacheCleaner();
  }

  async getConversation(conversationId: string): Promise<ConversationDetailDTO> {
    try {
      const { data } = await this.api.get(`/conversations/${conversationId}`);

      // Buscar nome do agente atribuído se houver
      let assignedAgentName = '';
      const assignedAgentId = data.assigned_agent_id || null;
      
      if (assignedAgentId) {
        const agent = await this.getAgent(assignedAgentId);
        if (agent) {
          assignedAgentName = `${agent.first_name} ${agent.last_name}`.trim();
        }
      }

      const customer =
        data.user ||
        (data.user_id ? await this.getUser(data.user_id) : null);

      const customerName =
        customer?.first_name ||
        customer?.name ||
        customer?.email ||
        '';
      const customerEmail = customer?.email || '';

      return {
        id: data.conversation_id || conversationId,
        customerId: data.user_id || '',
        customerName,
        customerEmail,
        createdAt: data.created_time || new Date().toISOString(),
        updatedAt: data.updated_time || new Date().toISOString(),
        status: data.status || '',
        assignedAgentId: assignedAgentId || undefined,
        assignedAgentName: assignedAgentName || '',
        messages: []
      };
    } catch (error: any) {
      throw new Error(`Erro ao buscar conversa ${conversationId}: ${error.message}`);
    }
  }

  async getUser(userId: string): Promise<{ id?: string; first_name?: string; last_name?: string; name?: string; email?: string; phone?: string } | null> {
    try {
      const { data } = await this.api.get(`/users/${userId}`);
      const user = data.user || data;

      return {
        id: user.id || userId,
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        email: user.email || '',
        phone: user.phone || ''
      };
    } catch (error: any) {
      console.warn(`⚠️ Erro ao buscar usuário ${userId}:`, error.message);
      return null;
    }
  }
  
  async getMessages(conversationId: string): Promise<MessageDTO[]> {
    try {
      let allMessages: MessageDTO[] = [];
      let page = 1;
      const itemsPerPage = 50;

      while (true) {
        console.log(`📄 Buscando mensagens da conversa ${conversationId} - página ${page}`);

        const { data } = await this.api.get(`/conversations/${conversationId}/messages`, {
          params: {
            page,
            items_per_page: itemsPerPage
          }
        });

        const messages = (data.messages || []).map((msg: any) => ({
          id: msg.id,
          messageType: this.mapMessageType(msg.message_type),
          actorType: this.mapActorType(msg.actor_type),
          actorId: msg.actor_id || msg.actor?.id,  // ← ADICIONAR esta linha
          actorName: msg.actor?.first_name || msg.actor?.email || '',
          content: this.extractContent(msg),
          createdAt: msg.created_time || new Date().toISOString(),
          hasMedia: this.hasMedia(msg),
          mediaUrls: this.extractMediaUrls(msg),
          isImportantNote: this.isImportantPrivateNote(msg)
        }));

        allMessages = allMessages.concat(messages);

        console.log(`✅ Página ${page} - ${messages.length} mensagens carregadas (total acumulado: ${allMessages.length})`);

        if (messages.length === 0 || messages.length < itemsPerPage) {
          console.log(`✅ Fim da paginação - ${allMessages.length} mensagens no total`);
          break;
        }

        page++;

        if (page > 100) {
          console.warn('⚠️ Limite de 100 páginas atingido, parando...');
          break;
        }
      }

      // Ordenar por data
      const sortedMessages = allMessages.sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      // ← ADICIONAR: Enriquecer com nomes dos agentes
      return await this.enrichMessagesWithAgentNames(sortedMessages);
    } catch (error: any) {
      throw new Error(`Erro ao buscar mensagens: ${error.message}`);
    }
  }  
  

  /**
   * Converte ID numérico (da URL) para UUID (da API)
   * Exemplo: 1093000478274692 → e5c32511-4969-45f1-b331-c45303ed08d2
   */
  async getConversationUUID(numericId: string): Promise<string | null> {
    try {
      console.log(`🔄 Convertendo ID numérico ${numericId} para UUID...`);

      // O endpoint /conversations/{id} aceita tanto UUID quanto ID numérico
      // e retorna os dados da conversa com o UUID correto
      const { data } = await this.api.get(`/conversations/${numericId}`);

      const uuid = data.conversation_id || data.id;
      console.log(`✅ UUID encontrado: ${uuid}`);
      
      return uuid;
    } catch (error: any) {
      console.error(`❌ Erro ao converter ID ${numericId}:`, error.message);
      return null;
    }
  }

  /**
   * Detecta se o ID é numérico ou UUID e busca adequadamente
   */
  async getConversationByAnyId(id: string): Promise<ConversationDetailDTO> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUUID = uuidRegex.test(id);

    if (isUUID) {
      // Já é UUID, buscar diretamente
      return await this.getConversation(id);
    } else {
      // É ID numérico, converter primeiro
      const uuid = await this.getConversationUUID(id);
      
      if (!uuid) {
        throw new Error(`Conversa ${id} não encontrada`);
      }

      return await this.getConversation(uuid);
    }
  }

  /**
   * Busca múltiplas conversas aceitando IDs numéricos ou UUIDs
   */
  async getMultipleConversationsByAnyId(ids: string[]): Promise<ConversationDetailDTO[]> {
    const conversations: ConversationDetailDTO[] = [];

    for (const id of ids) {
      try {
        const conv = await this.getConversationByAnyId(id);
        const messages = await this.getMessages(conv.id); // Usar o UUID retornado
        conv.messages = messages;
        conversations.push(conv);
      } catch (error: any) {
        if (error.message.includes('404') || error.message.includes('não encontrada')) {
          console.warn(`⚠️ Conversa ${id} não encontrada (404), pulando...`);
          continue;
        }
        throw error;
      }
    }

    console.log(`✅ ${conversations.length} de ${ids.length} conversas carregadas`);
    return conversations;
  }

  private async fetchMessagesPageWithFallback(
    conversationId: string,
    page: number,
    itemsPerPage: number
  ): Promise<{ mode: MessagePaginationMode; messages: any[] }> {
    const modes: MessagePaginationMode[] = ['page_items_per_page', 'page_per_page', 'items_per_page', 'none'];
    let lastError: any = null;

    for (const mode of modes) {
      try {
        const messages = await this.fetchMessagesPage(conversationId, page, itemsPerPage, mode);
        console.log(`✅ Paginação de mensagens aceita no modo: ${mode}`);
        return { mode, messages };
      } catch (error: any) {
        lastError = error;
        if (error?.response?.status !== 400) {
          throw error;
        }
      }
    }

    throw lastError || new Error('Nenhum modo de paginação aceito pela API de mensagens');
  }

  private async fetchMessagesPage(
    conversationId: string,
    page: number,
    itemsPerPage: number,
    mode: MessagePaginationMode
  ): Promise<any[]> {
    const paramsByMode: Record<MessagePaginationMode, Record<string, number>> = {
      page_items_per_page: { page, items_per_page: itemsPerPage },
      page_per_page: { page, per_page: itemsPerPage },
      items_per_page: { items_per_page: itemsPerPage },
      none: {}
    };

    const { data } = await this.api.get(`/conversations/${conversationId}/messages`, {
      params: paramsByMode[mode]
    });

    if (Array.isArray(data?.messages)) return data.messages;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  }

  async getMultipleConversations(conversationIds: string[]) {
    console.log(`📊 Buscando ${conversationIds.length} conversas em paralelo...`);
    
    // ✅ PARALELO - Todas ao mesmo tempo
    const promises = conversationIds.map(async (id) => {
      try {
        return await this.getConversationByAnyId(id);
      } catch (error: any) {
        console.warn(`⚠️ Falha ao buscar conversa ${id}:`, error.message);
        return null;
      }
    });

    const results = await Promise.all(promises);
    const conversations = results.filter(Boolean);

    console.log(`✅ ${conversations.length}/${conversationIds.length} conversas carregadas`);
    return conversations;
  }

  async getMessagesForMultipleConversations(conversationIds: string[]) {
    console.log(`📨 Buscando mensagens para ${conversationIds.length} conversas em paralelo...`);

    const promises = conversationIds.map(async (id) => {
      try {
        const messages = await this.getMessages(id);
        return { id, messages };
      } catch (error: any) {
        console.warn(`⚠️ Falha ao buscar mensagens de ${id}:`, error.message);
        return { id, messages: [] };
      }
    });

    const results = await Promise.all(promises);
    return new Map(results.map(r => [r.id, r.messages]));
  }

  async getMultipleAgents(agentIds: string[]) {
    const uniqueIds = [...new Set(agentIds)];
    console.log(`👥 Buscando ${uniqueIds.length} agentes em paralelo...`);

    const promises = uniqueIds.map(async (id) => {
      const agent = await this.getAgent(id);
      return { id, agent };
    });

    const results = await Promise.all(promises);
    
    const agentsMap = new Map();
    results.forEach(({ id, agent }) => {
      if (agent) {
        agentsMap.set(id, `${agent.first_name} ${agent.last_name}`.trim());
      }
    });

    console.log(`✅ ${agentsMap.size}/${uniqueIds.length} agentes carregados`);
    return agentsMap;
  }

  /**
   * Busca informações de um agente pelo ID
   */
  async getAgent(agentId: string): Promise<{ first_name: string; last_name: string; email?: string } | null> {
    try {
      // ✅ Verificar cache com TTL
      const now = Date.now();
      const expiry = this.agentsCacheExpiry.get(agentId);
      
      if (this.agentsCache.has(agentId) && expiry && expiry > now) {
        console.log(`💾 Cache hit: agente ${agentId}`);
        return this.agentsCache.get(agentId)!;
      }

      console.log(`🌐 Cache miss: buscando agente ${agentId}`);
      const { data } = await this.api.get(`/agents/${agentId}`);

      const agent = {
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        email: data.email || undefined
      };

      // ✅ Salvar no cache com expiry
      this.agentsCache.set(agentId, agent);
      this.agentsCacheExpiry.set(agentId, now + this.CACHE_TTL);

      return agent;
    } catch (error: any) {
      console.warn(`⚠️ Erro ao buscar agente ${agentId}:`, error.message);
      return null;
    }
  }

  /**
   * Enriquece mensagens com nomes dos agentes
   */
  async enrichMessagesWithAgentNames(messages: any[]) {
    const agentIds = [...new Set(
      messages
        .filter(m => m.actorType === 'AGENT' && m.actorId)
        .map(m => m.actorId)
    )];

    if (agentIds.length === 0) return messages;

    // ✅ Buscar todos de uma vez
    const agentsMap = await this.getMultipleAgents(agentIds);

    return messages.map(msg => ({
      ...msg,
      actorName: msg.actorType === 'AGENT' && msg.actorId
        ? agentsMap.get(msg.actorId) || 'Agente'
        : msg.actorName
    }));
  }
  
  async getConversationComplete(conversationId: string) {
    console.log(`📋 Buscando conversa completa: ${conversationId}`);

    const conversation = await this.getConversationByAnyId(conversationId);
    const messages = await this.getMessages(conversation.id);

    return {
      ...conversation,
      messages
    };
  }

  async getMultipleConversationsComplete(conversationIds: string[]): Promise<ConversationDetailDTO[]> {
    console.log(`📚 Buscando ${conversationIds.length} conversas completas em paralelo...`);

    const promises = conversationIds.map(async (id) => {
      try {
        return await this.getConversationComplete(id);
      } catch (error: any) {
        console.warn(`⚠️ Falha ao buscar conversa completa ${id}:`, error.message);
        return null;
      }
    });

    const results = await Promise.all(promises);
    const conversations = results.filter(Boolean) as ConversationDetailDTO[];

    console.log(`✅ ${conversations.length}/${conversationIds.length} conversas completas carregadas`);
    return conversations;
  }

  async getUserIdsByEmail(email: string): Promise<string[]> {
    try {
      console.log('🔍 Buscando usuários com email:', email);

      const { data } = await this.api.get('/users', {
        params: { email }
      });

      console.log('📥 Resposta da API:', JSON.stringify(data, null, 2));

      const users = data.users || [];

      if (users.length === 0) {
        console.log('❌ Nenhum usuário encontrado');
        return [];
      }

      const userIds = users.map((user: any) => user.id).filter(Boolean);
      console.log(`✅ ${userIds.length} usuário(s) encontrado(s):`, userIds);
      
      return userIds;
    } catch (error: any) {
      console.error('❌ Erro ao buscar usuários:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      return [];
    }
  }

    async getConversationsByUserId(userId: string): Promise<string[]> {
    try {
      console.log('🔍 Buscando conversas do usuário:', userId);

      const { data } = await this.api.get(`/users/${userId}/conversations`, {
        params: {
          items_per_page: 50
        }
      });

      console.log('📥 Resposta de conversas:', JSON.stringify(data, null, 2));

      const conversations = data.conversations || [];
      
      // A API retorna { "id": "xxx" } para cada conversa
      const ids = conversations
        .map((conv: any) => conv.id || conv.conversation_id)
        .filter((id: string) => id); // Remove undefined/null

      console.log(`✅ ${ids.length} conversas encontradas`);
      console.log('IDs:', ids);
      
      return ids;
    } catch (error: any) {
      console.error('❌ Erro ao buscar conversas:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw new Error(`Erro ao buscar conversas: ${error.message}`);
    }
  }

  /**
   * Busca conversas de um cliente específico
   */
  async getConversationsByCustomer(userId: string): Promise<string[]> {
    try {
      console.log('🔍 Buscando conversas do usuário:', userId);

      const { data } = await this.api.get('/conversations', {
        params: {
          user_id: userId
        }
      });

      console.log('📥 Resposta de conversas:', JSON.stringify(data, null, 2));

      const conversations = data.conversations || data.data || [];
      const ids = conversations.map((conv: any) => conv.conversation_id || conv.id);

      console.log(`✅ ${ids.length} conversas encontradas`);
      return ids;
    } catch (error: any) {
      console.error('❌ Erro ao buscar conversas:', error.message);
      throw new Error(`Erro ao buscar conversas do cliente: ${error.message}`);
    }
  }

  /**
   * Extrai conteúdo de texto de uma mensagem
   */
  private extractContent(message: any): string {
    let content = '';

    if (message.message_parts) {
      for (const part of message.message_parts) {
        if (part.text?.content) {
          content += part.text.content + ' ';
        }
      }
    }

    return content.trim();
  }

  /**
   * Verifica se a mensagem tem mídia
   */
  private hasMedia(message: any): boolean {
    if (!message.message_parts) return false;

    return message.message_parts.some((part: any) => 
      part.image || part.file || part.video || part.audio
    );
  }

  /**
   * Extrai URLs de mídia
   */
  private extractMediaUrls(message: any): string[] {
    const urls: string[] = [];

    if (!message.message_parts) return urls;

    for (const part of message.message_parts) {
      if (part.image?.url) urls.push(part.image.url);
      if (part.file?.url) urls.push(part.file.url);
      if (part.video?.url) urls.push(part.video.url);
      if (part.audio?.url) urls.push(part.audio.url);

      // Verifica JSON inline (formato usado no Python original)
      const textContent = part.text?.content || '';
      if (textContent.includes('"type":"IMAGE"')) {
        const urlMatch = textContent.match(/"mediaUrl"\s*:\s*"([^"]+)"/);
        if (urlMatch) urls.push(urlMatch[1]);
      }
    }

    return urls;
  }

  /**
   * Verifica se é uma nota privada importante (com marcadores)
   */
  private isImportantPrivateNote(message: any): boolean {
    if (message.message_type !== 'private') return false;

    const content = this.extractContent(message).toUpperCase();
    
    const importantMarkers = [
      '@SOLICITAÇÃO DE APOIO N2',
      '@SOLICITACAO DE APOIO N2',
      '@REGISTRO SUGESTÃO',
      '@REGISTRO SUGESTAO',
      '@REGISTRO CANCELAMENTO',
      '@ESCALADO',
      '@CRÍTICO',
      '@CRITICO',
      '@URGENTE',
      '@BUG REPORTADO',
      '@FEATURE REQUEST',
      '@FEEDBACK IMPORTANTE'
    ];

    return importantMarkers.some(marker => content.includes(marker));
  }

  private mapMessageType(type?: string): 'NORMAL' | 'PRIVATE' | 'SYSTEM' {
    if (!type) return 'NORMAL';
    switch (type.toLowerCase()) {
      case 'private': return 'PRIVATE';
      case 'system': return 'SYSTEM';
      default: return 'NORMAL';
    }
  }

  private mapActorType(type?: string): 'USER' | 'AGENT' | 'SYSTEM' | 'BOT' {
    if (!type) return 'SYSTEM';
    switch (type.toLowerCase()) {
      case 'user': return 'USER';
      case 'agent': return 'AGENT';
      case 'bot': return 'BOT';
      default: return 'SYSTEM';
    }
  }
  
    private startCacheCleaner() {
    this.cacheCleanerInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [agentId, expiry] of this.agentsCacheExpiry.entries()) {
        if (expiry <= now) {
          this.agentsCache.delete(agentId);
          this.agentsCacheExpiry.delete(agentId);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        console.log(`🧹 Cache limpo: ${cleaned} agentes removidos`);
      }
    }, 1000 * 60 * 30); // 30 minutos
  }

  clearAgentsCache() {
    this.agentsCache.clear();
    this.agentsCacheExpiry.clear();
    console.log('🗑️ Cache de agentes limpo manualmente');
  }

  getCacheStats() {
    return {
      totalCached: this.agentsCache.size,
      expiryEntries: this.agentsCacheExpiry.size
    };
  }

  destroy() {
    if (this.cacheCleanerInterval) {
      clearInterval(this.cacheCleanerInterval);
    }
    this.clearAgentsCache();
  }
}

