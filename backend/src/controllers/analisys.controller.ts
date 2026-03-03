import { Request, Response, NextFunction } from 'express';

import { randomUUID } from 'crypto';
import { FreshchatCacheService } from '../services/freshchat-cache.service';
import { GeminiService } from '../services/gemini.service';
import { MediaService } from '../services/media.service';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { catchAsync } from '../utils/catchAsync';

// ✅ USAR CACHE SERVICE ao invés do Freshchat direto
const cacheService = new FreshchatCacheService();
const geminiService = new GeminiService();
const mediaService = new MediaService();

type AnalysisJobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

interface AnalysisJob {
  id: string;
  userId: string;
  conversationIds: string[];
  status: AnalysisJobStatus;
  progress: number;
  message: string;
  analysisId?: string;
  conversationId?: string;
  cached?: boolean;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  updatedAt: Date;
}

const analysisJobs = new Map<string, AnalysisJob>();
const JOB_TTL_MS = 1000 * 60 * 60 * 24; // 24h

export class AnalysisController {
  private readonly CACHE_BATCH_SIZE = 2;

  create = catchAsync(async (req: Request & { userId?: string }, res: Response, next: NextFunction) => {
    const { conversationIds: rawConversationIds } = req.body;
    const userId = req.userId!;
    const conversationIds = this.normalizeConversationIds(rawConversationIds);

    if (conversationIds.length === 0) {
      throw new AppError('Forneca pelo menos um ID de conversa valido', 400);
    }

    this.cleanupOldJobs();

    const jobId = randomUUID();
    const now = new Date();

    analysisJobs.set(jobId, {
      id: jobId,
      userId,
      conversationIds,
      status: 'QUEUED',
      progress: 0,
      message: 'Analise enfileirada',
      createdAt: now,
      updatedAt: now
    });

    void this.processJob(jobId, userId, conversationIds);

    return res.status(202).json({
      jobId,
      status: 'QUEUED',
      progress: 0,
      message: 'Analise enfileirada'
    });
  });

  getJobStatus = catchAsync(async (req: Request & { userId?: string }, res: Response, next: NextFunction) => {
    const { jobId } = req.params;
    const userId = req.userId!;
    const job = analysisJobs.get(jobId);

    if (!job || job.userId !== userId) {
      throw new AppError('Job de analise nao encontrado', 404);
    }

    res.json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      message: job.message,
      conversationIds: job.conversationIds,
      analysisId: job.analysisId,
      conversationId: job.conversationId,
      cached: job.cached,
      error: job.error,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      updatedAt: job.updatedAt
    });
  });

  private normalizeConversationIds(rawIds: unknown): string[] {
    if (!Array.isArray(rawIds)) return [];

    const deduped = new Set<string>();

    for (const value of rawIds) {
      if (typeof value !== 'string') continue;
      const id = value.trim();
      if (id) deduped.add(id);
    }

    return Array.from(deduped);
  }

  private async mapInBatches<T, R>(
    items: T[],
    batchSize: number,
    handler: (item: T) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = [];

    for (let index = 0; index < items.length; index += batchSize) {
      const batch = items.slice(index, index + batchSize);
      const batchResults = await Promise.all(batch.map(handler));
      results.push(...batchResults);
    }

    return results;
  }

  private updateJob(jobId: string, updates: Partial<AnalysisJob>) {
    const current = analysisJobs.get(jobId);
    if (!current) return;

    analysisJobs.set(jobId, {
      ...current,
      ...updates,
      updatedAt: new Date()
    });
  }

  private cleanupOldJobs() {
    const now = Date.now();

    for (const [jobId, job] of analysisJobs.entries()) {
      const referenceTime = job.finishedAt?.getTime() || job.updatedAt.getTime();
      if (now - referenceTime > JOB_TTL_MS) {
        analysisJobs.delete(jobId);
      }
    }
  }

  private async processJob(jobId: string, userId: string, conversationIds: string[]) {
    this.updateJob(jobId, {
      status: 'RUNNING',
      progress: 5,
      message: 'Iniciando analise...',
      startedAt: new Date()
    });

    try {
      const { analysis, cached } = await this.runAnalysis(conversationIds, userId, (progress, message) => {
        this.updateJob(jobId, { progress, message });
      });

      this.updateJob(jobId, {
        status: 'COMPLETED',
        progress: 100,
        message: cached ? 'Analise retornada do cache' : 'Analise finalizada',
        analysisId: analysis.id,
        conversationId: analysis.conversationId,
        cached,
        finishedAt: new Date()
      });
    } catch (error: any) {
      this.updateJob(jobId, {
        status: 'FAILED',
        progress: 100,
        message: 'Falha ao processar analise',
        error: error?.message || 'Erro desconhecido',
        finishedAt: new Date()
      });
    }
  }

  private async runAnalysis(
    conversationIds: string[],
    userId: string,
    onProgress?: (progress: number, message: string) => void
  ) {
    if (conversationIds.length === 1) {
      const existing = await prisma.analysis.findFirst({
        where: {
          conversationId: conversationIds[0]
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (existing) {
        // Vincula a análise ao histórico do usuário se já existir
        await prisma.analysisHistory.upsert({
          where: {
            userId_analysisId: { userId, analysisId: existing.id }
          },
          update: { viewedAt: new Date() },
          create: { userId, analysisId: existing.id }
        });

        return { analysis: existing, cached: true };
      }
    }

    const startTime = Date.now();

    // ✅ USAR CACHE SERVICE
    onProgress?.(15, 'Buscando conversas (com cache)...');
    const conversations = await this.mapInBatches(
      conversationIds,
      this.CACHE_BATCH_SIZE,
      async (id) => cacheService.getConversation(id)
    );

    if (conversations.length === 0) {
      throw new AppError('Nenhuma conversa encontrada para os IDs informados', 404);
    }

    onProgress?.(40, 'Montando transcricao consolidada...');
    let fullTranscript = '';
    const allMediaUrls: string[] = [];

    for (const conv of conversations) {
      fullTranscript += `\n\n=== CONVERSA ${conv.id} ===\n`;
      fullTranscript += `Cliente: ${conv.customerName || conv.customerEmail || 'N/A'}\n`;
      fullTranscript += `Agente: ${conv.assignedAgentName || 'N/A'}\n`;
      fullTranscript += `Status: ${conv.status || 'N/A'}\n\n`;

      // ✅ USAR CACHE SERVICE para mensagens
      onProgress?.(30, `Buscando mensagens da conversa ${conv.id}...`);
      const messages = await cacheService.getMessages(conv.id);

      for (const msg of messages) {
        const time = new Date(msg.createdAt).toLocaleString('pt-BR');
        const actor =
          msg.actorType === 'USER' ? 'Cliente' :
            msg.messageType === 'PRIVATE' ? 'Nota Privada' :
              msg.actorName || 'Agente'; // ✅ Nome já vem do cache

        fullTranscript += `[${time}] ${actor}${msg.isImportantNote ? ' [IMPORTANT]' : ''}: ${msg.content}\n`;

        if (msg.hasMedia) {
          allMediaUrls.push(...msg.mediaUrls);
        }
      }
    }

    onProgress?.(55, 'Processando midias...');
    const processedMedia = await mediaService.processMediaForAI(allMediaUrls);

    onProgress?.(70, 'Gerando analise com IA...');
    const prompt = geminiService.createAnalysisPrompt();
    const analysisText = await geminiService.generateAnalysis(
      fullTranscript,
      processedMedia,
      prompt
    );

    const processingTime = Date.now() - startTime;
    const tokensUsed = geminiService.estimateTokens(fullTranscript, processedMedia.length);

    onProgress?.(85, 'Salvando resultado...');

    // Parse do texto para extrair as variáveis do JSON gerado
    const parsedData = geminiService.parseStructuredAnalysis(analysisText);

    // Salvar no banco a análise com toda a estrutura
    const mainConversation = conversations[0];
    const analysis = await prisma.analysis.create({
      data: {
        conversationId: mainConversation.id,
        executiveSummary: parsedData.resumoExecutivo.substring(0, 500) || analysisText.substring(0, 500),
        fullAnalysisText: analysisText,

        mainProblem: parsedData.problemaPrincipal as any,
        timeline: parsedData.linhaDoTempo as any,
        handoffs: parsedData.participacaoHandoffs as any,
        agentConduct: parsedData.conducaoAtendimento as any,

        riskLevel: parsedData.riscoOperacional.criticidadeGeral,
        riskRecontact: parsedData.riscoOperacional.recontato.nivel,
        riskDissatisfaction: parsedData.riscoOperacional.insatisfacao.nivel,
        riskChurn: parsedData.riscoOperacional.churn.nivel,

        recommendedActions: parsedData.acoesRecomendadas as any,
        keyEvidences: parsedData.evidenciasChave as any,

        tokensUsed,
        processingTime,
        mediaProcessed: processedMedia.length,

        history: {
          create: {
            user: {
              connect: { id: userId }
            }
          }
        }
      }
    });

    onProgress?.(100, 'Concluído!');

    return { analysis, cached: false };
  }

  list = catchAsync(async (req: Request & { userId?: string }, res: Response, next: NextFunction) => {
    const userId = req.userId!;

    const histories = await prisma.analysisHistory.findMany({
      where: { userId },
      include: {
        analysis: {
          include: { conversation: true }
        }
      },
      orderBy: { viewedAt: 'desc' }
    });

    const analyses = histories.map(h => h.analysis);

    const formatted = analyses.map(a => ({
      id: a.id,
      conversationId: a.conversationId,
      preview: a.fullAnalysisText?.substring(0, 200) || a.executiveSummary || 'Sem conteudo',
      executiveSummary: a.executiveSummary,
      riskLevel: a.riskLevel,
      tokensUsed: a.tokensUsed,
      mediaProcessed: a.mediaProcessed,
      processingTime: a.processingTime,
      createdAt: a.createdAt,
      conversation: {
        customerName: a.conversation?.customerName,
        customerEmail: a.conversation?.customerEmail,
        assignedAgentName: a.conversation?.assignedAgentName
      }
    }));

    res.json(formatted);
  });

  getById = catchAsync(async (req: Request & { userId?: string }, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = req.userId!;

    const history = await prisma.analysisHistory.findFirst({
      where: {
        analysisId: id,
        userId
      },
      include: {
        analysis: {
          include: { conversation: true }
        }
      }
    });

    if (!history || !history.analysis) {
      throw new AppError('Analise nao encontrada', 404);
    }

    res.json({
      id: history.analysis.id,
      conversationId: history.analysis.conversationId,
      analysisText: history.analysis.fullAnalysisText || history.analysis.executiveSummary,
      fullAnalysisText: history.analysis.fullAnalysisText,
      executiveSummary: history.analysis.executiveSummary,
      riskLevel: history.analysis.riskLevel,

      // Enviando todos os novos campos para o Frontend!
      mainProblem: history.analysis.mainProblem,
      timeline: history.analysis.timeline,
      handoffs: history.analysis.handoffs,
      agentConduct: history.analysis.agentConduct,
      recommendedActions: history.analysis.recommendedActions,
      keyEvidences: history.analysis.keyEvidences,

      metadata: {
        tokensUsed: history.analysis.tokensUsed,
        mediaProcessed: history.analysis.mediaProcessed,
        processingTimeMs: history.analysis.processingTime
      },
      conversation: {
        customerName: history.analysis.conversation?.customerName,
        customerEmail: history.analysis.conversation?.customerEmail,
        assignedAgentName: history.analysis.conversation?.assignedAgentName,
        status: history.analysis.conversation?.status
      }
    });
  });

  delete = catchAsync(async (req: Request & { userId?: string }, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = req.userId!;

    // Deletar a relação do Histórico.
    // Como a relação History -> Analysis tem onDelete: Cascade,
    // SE for o último user atrelado àquela análise, deixamos a análise lá ou a deletamos?
    // Nesse caso de histórico, só vamos remover do painel dele:

    const history = await prisma.analysisHistory.findUnique({
      where: { userId_analysisId: { userId, analysisId: id } }
    });

    if (!history) {
      throw new AppError('Análise não encontrada no seu histórico', 404);
    }

    await prisma.analysisHistory.delete({
      where: { userId_analysisId: { userId, analysisId: id } }
    });

    res.json({
      message: 'Analise removida com sucesso',
      id
    });
  });

  reanalyze = catchAsync(async (req: Request & { userId?: string }, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = req.userId!;

    // Encontrar o histórico
    const history = await prisma.analysisHistory.findFirst({
      where: { analysisId: id, userId },
      include: { analysis: true }
    });

    if (!history) {
      throw new AppError('Análise não encontrada no seu histórico', 404);
    }

    const conversationId = history.analysis.conversationId;

    // Removemos do histórico dele, E deletamos a análise do sistema para forçar reconexão.
    // Como Análise Cascade Histórico, ao deletar a análise, apaga dos históricos também.
    await prisma.analysis.delete({ where: { id } });

    res.json({
      message: 'Analise removida. Gere uma nova analise.',
      conversationId: history.analysis.conversationId
    });
  });

  // ✅ BATCH com cache
  createBatch = catchAsync(async (req: Request & { userId?: string }, res: Response, next: NextFunction) => {
    const { conversationIds } = req.body;
    const userId = req.userId!;

    if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
      throw new AppError('Forneca um array de IDs de conversas', 400);
    }

    const results = [];

    for (const convId of conversationIds) {
      try {
        const existing = await prisma.analysis.findFirst({
          where: { conversationId: convId },
          orderBy: { createdAt: 'desc' }
        });

        if (existing) {
          await prisma.analysisHistory.upsert({
            where: { userId_analysisId: { userId, analysisId: existing.id } },
            update: { viewedAt: new Date() },
            create: { userId, analysisId: existing.id }
          });

          results.push({
            conversationId: convId,
            analysisId: existing.id,
            cached: true,
            tokensUsed: existing.tokensUsed
          });
          continue;
        }

        // ✅ USAR CACHE SERVICE
        const conversation = await cacheService.getConversation(convId);
        const messages = await cacheService.getMessages(convId);

        const analysis = await this.generateSingleAnalysis(
          { ...conversation, messages },
          userId
        );

        results.push({
          conversationId: convId,
          analysisId: analysis.id,
          cached: false,
          tokensUsed: analysis.tokensUsed
        });
      } catch (error: any) {
        results.push({
          conversationId: convId,
          error: error.message,
          failed: true
        });
      }
    }

    const consolidated = await this.generateConsolidatedReport(results, userId);

    res.json({
      results,
      consolidated,
      summary: {
        total: conversationIds.length,
        successful: results.filter(r => !(r as any).failed).length,
        failed: results.filter(r => (r as any).failed).length,
        cached: results.filter(r => (r as any).cached).length,
        totalTokens: results.reduce((sum, r) => sum + ((r as any).tokensUsed || 0), 0)
      }
    });
  });

  private async generateSingleAnalysis(conversation: any, userId: string) {
    const startTime = Date.now();
    let fullTranscript = `Cliente: ${conversation.customerName || 'N/A'}\n`;
    fullTranscript += `Agente: ${conversation.assignedAgentName || 'N/A'}\n\n`;

    const allMediaUrls: string[] = [];

    for (const msg of conversation.messages) {
      const time = new Date(msg.createdAt).toLocaleString('pt-BR');
      const actor = msg.actorType === 'USER' ? 'Cliente' : (msg.actorName || 'Agente');
      fullTranscript += `[${time}] ${actor}: ${msg.content}\n`;
      if (msg.hasMedia) allMediaUrls.push(...msg.mediaUrls);
    }

    const processedMedia = await mediaService.processMediaForAI(allMediaUrls);
    const prompt = geminiService.createAnalysisPrompt();
    const analysisText = await geminiService.generateAnalysis(fullTranscript, processedMedia, prompt);
    const tokensUsed = geminiService.estimateTokens(fullTranscript, processedMedia.length);
    const processingTime = Date.now() - startTime;

    // Parse JSON
    const parsedData = geminiService.parseStructuredAnalysis(analysisText);

    return await prisma.analysis.create({
      data: {
        conversationId: conversation.id,
        executiveSummary: parsedData.resumoExecutivo.substring(0, 500) || analysisText.substring(0, 500),
        fullAnalysisText: analysisText,

        mainProblem: parsedData.problemaPrincipal as any,
        timeline: parsedData.linhaDoTempo as any,
        handoffs: parsedData.participacaoHandoffs as any,
        agentConduct: parsedData.conducaoAtendimento as any,

        riskLevel: parsedData.riscoOperacional.criticidadeGeral,
        riskRecontact: parsedData.riscoOperacional.recontato.nivel,
        riskDissatisfaction: parsedData.riscoOperacional.insatisfacao.nivel,
        riskChurn: parsedData.riscoOperacional.churn.nivel,

        recommendedActions: parsedData.acoesRecomendadas as any,
        keyEvidences: parsedData.evidenciasChave as any,

        tokensUsed,
        processingTime,
        mediaProcessed: processedMedia.length,

        history: {
          create: { userId }
        }
      }
    });
  }

  private async generateConsolidatedReport(results: any[], userId: string) {
    const successfulAnalyses = results.filter(r => !r.failed);

    if (successfulAnalyses.length === 0) {
      return { error: 'Nenhuma analise bem-sucedida' };
    }

    // Buscar análises consolidadas a partir do histórico
    const histories = await prisma.analysisHistory.findMany({
      where: {
        analysisId: { in: successfulAnalyses.map(r => r.analysisId) },
        userId
      },
      include: {
        analysis: { include: { conversation: true } }
      }
    });

    const analyses = histories.map(h => h.analysis);

    const agentPerformance = new Map<string, { count: number; scores: number[] }>();

    analyses.forEach(analysis => {
      const agentName = analysis.conversation?.assignedAgentName || 'Desconhecido';

      if (!agentPerformance.has(agentName)) {
        agentPerformance.set(agentName, { count: 0, scores: [] });
      }

      const perf = agentPerformance.get(agentName)!;
      perf.count++;

      const text = analysis.fullAnalysisText || '';
      const scoreMatch = text.match(/(\d+)\/2/g);
      if (scoreMatch) {
        scoreMatch.forEach(m => {
          const score = parseInt(m.split('/')[0], 10);
          perf.scores.push(score);
        });
      }
    });

    const agentStats = Array.from(agentPerformance.entries()).map(([agent, data]) => ({
      agent,
      conversationsHandled: data.count,
      averageScore: data.scores.length > 0
        ? (data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(1)
        : 'N/A'
    }));

    return {
      totalAnalyzed: analyses.length,
      agentPerformance: agentStats,
      topAgent: agentStats.sort((a, b) =>
        parseFloat(String(b.averageScore)) - parseFloat(String(a.averageScore))
      )[0]
    };
  }

  // ✅ Endpoints de cache
  getCacheStats = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const stats = await cacheService.getCacheStats();
    res.json(stats);
  });

  cleanCache = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await cacheService.cleanExpiredCache();
    res.json({ message: 'Cache limpo com sucesso' });
  });
}
