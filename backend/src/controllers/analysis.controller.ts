import { Request, Response, NextFunction } from 'express';

import { randomUUID } from 'crypto';
import { FreshchatCacheService } from '../services/freshchat-cache.service';
import { AnalysisJobService } from '../services/analysis-job.service';
import { GeminiService } from '../services/gemini.service';
import { MediaService } from '../services/media.service';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { catchAsync } from '../utils/catchAsync';

// ✅ USAR CACHE SERVICE ao invés do Freshchat direto
const cacheService = new FreshchatCacheService();
const geminiService = new GeminiService();
const mediaService = new MediaService();

export class AnalysisController {
  private readonly CACHE_BATCH_SIZE = 2;
  private readonly JOB_TTL_MS = 1000 * 60 * 60 * 24; // 24h
  private readonly MAX_CONVERSATIONS_PER_JOB = this.getEnvInt('ANALYSIS_MAX_CONVERSATIONS_PER_JOB', 10);
  private readonly MAX_ACTIVE_JOBS_PER_USER = this.getEnvInt('ANALYSIS_MAX_ACTIVE_JOBS_PER_USER', 2);
  private readonly MAX_ACTIVE_JOBS_GLOBAL = this.getEnvInt('ANALYSIS_MAX_ACTIVE_JOBS_GLOBAL', 20);
  private readonly RESUME_JOB_BATCH_SIZE = this.getEnvInt('ANALYSIS_RESUME_JOB_BATCH_SIZE', 10);
  private readonly jobService = new AnalysisJobService();
  private readonly jobsBootstrapPromise: Promise<void>;

  constructor() {
    this.jobsBootstrapPromise = this.bootstrapJobs();
  }

  private getEnvInt(name: string, fallback: number): number {
    const parsed = Number(process.env[name]);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  }

  private async bootstrapJobs() {
    await this.jobService.ensureTable();
    await this.jobService.requeueStaleRunningJobs();
    await this.jobService.cleanupOldJobs(this.JOB_TTL_MS);

    const queuedJobIds = await this.jobService.listQueuedJobIds(this.RESUME_JOB_BATCH_SIZE);
    queuedJobIds.forEach((jobId) => {
      void this.processJob(jobId);
    });
  }

  private async ensureJobsReady() {
    await this.jobsBootstrapPromise;
  }

  create = catchAsync(async (req: Request & { userId?: string }, res: Response, next: NextFunction) => {
    await this.ensureJobsReady();

    const { conversationIds: rawConversationIds, analysisType = 'individual' } = req.body;
    const userId = req.userId!;
    const conversationIds = this.normalizeConversationIds(rawConversationIds);

    if (conversationIds.length === 0) {
      throw new AppError('Forneca pelo menos um ID de conversa valido', 400);
    }

    const limit = analysisType === 'history' ? 50 : this.MAX_CONVERSATIONS_PER_JOB;
    if (conversationIds.length > limit) {
      throw new AppError(
        `Este tipo de analise aceita no maximo ${limit} conversas por requisicao`,
        400
      );
    }

    const [activeJobsForUser, activeJobsGlobal] = await Promise.all([
      this.jobService.countActiveJobsForUser(userId),
      this.jobService.countActiveJobs()
    ]);

    if (activeJobsForUser >= this.MAX_ACTIVE_JOBS_PER_USER) {
      throw new AppError('Voce ja possui analises em andamento. Aguarde a conclusao antes de criar novas.', 429);
    }

    if (activeJobsGlobal >= this.MAX_ACTIVE_JOBS_GLOBAL) {
      throw new AppError('Fila de analises temporariamente cheia. Tente novamente em instantes.', 503);
    }

    await this.jobService.cleanupOldJobs(this.JOB_TTL_MS);

    const jobId = randomUUID();

    await this.jobService.createJob({
      id: jobId,
      userId,
      conversationIds,
      status: 'QUEUED',
      progress: 0,
      message: 'Analise enfileirada',
      analysisType // Passando o tipo para o job
    } as any);

    void this.processJob(jobId);

    return res.status(202).json({
      jobId,
      status: 'QUEUED',
      progress: 0,
      message: 'Analise enfileirada'
    });
  });

  getJobStatus = catchAsync(async (req: Request & { userId?: string }, res: Response, next: NextFunction) => {
    await this.ensureJobsReady();

    const { jobId } = req.params;
    const userId = req.userId!;
    const job = await this.jobService.getJobForUser(jobId, userId);

    if (!job) {
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

  private async processJob(jobId: string) {
    await this.ensureJobsReady();

    const job = await this.jobService.claimQueuedJob(jobId);
    if (!job) return;

    try {
      const { analysis, cached } = await this.runAnalysis(
        job.conversationIds,
        job.userId,
        (job as any).analysisType || 'individual',
        (progress, message) => {
          return this.jobService.updateJob(jobId, { progress, message });
        }
      );

      await this.jobService.updateJob(jobId, {
        status: 'COMPLETED',
        progress: 100,
        message: cached ? 'Analise retornada do cache' : 'Analise finalizada',
        analysisId: analysis.id,
        conversationId: analysis.conversationId,
        cached,
        finishedAt: new Date()
      });
    } catch (error: any) {
      await this.jobService.updateJob(jobId, {
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
    analysisType: 'individual' | 'history' = 'individual',
    onProgress?: (progress: number, message: string) => void
  ) {
    if (conversationIds.length === 1 && analysisType === 'individual') {
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
              msg.actorName || 'Agente'; 

        fullTranscript += `[${time}] ${actor}${msg.isImportantNote ? ' [IMPORTANT]' : ''}: ${msg.content}\n`;

        if (msg.hasMedia) {
          allMediaUrls.push(...msg.mediaUrls);
        }
      }
    }

    onProgress?.(55, 'Processando midias...');
    const processedMedia = await mediaService.processMediaForAI(allMediaUrls);

    onProgress?.(70, 'Gerando analise com IA...');
    const prompt = analysisType === 'history' 
      ? geminiService.createHistoryAnalysisPrompt()
      : geminiService.createAnalysisPrompt();
      
    const analysisText = await geminiService.generateAnalysis(
      fullTranscript,
      processedMedia,
      prompt
    );

    const processingTime = Date.now() - startTime;
    const tokensUsed = geminiService.estimateTokens(fullTranscript, processedMedia.length);

    onProgress?.(85, 'Salvando resultado...');

    // Parse do texto para extrair as variáveis do JSON gerado
    const parsedData = analysisType === 'history'
      ? geminiService.parseHistoryAnalysis(analysisText)
      : geminiService.parseStructuredAnalysis(analysisText);

    // Salvar no banco a análise com toda a estrutura
    const mainConversation = conversations[0];
    const analysisData: any = {
      type: analysisType === 'history' ? 'HISTORY' : 'INDIVIDUAL',
      conversationId: analysisType === 'history' ? null : mainConversation.id,
      customerId: mainConversation.customerId,
      customerEmail: mainConversation.customerEmail,
      fullAnalysisText: analysisText,
      tokensUsed,
      processingTime,
      mediaProcessed: processedMedia.length,
      history: {
        create: {
          user: { connect: { id: userId } }
        }
      }
    };

    if (analysisType === 'history') {
      analysisData.executiveSummary = parsedData.resumoExecutivo.substring(0, 1000);
      analysisData.mainProblem = parsedData.perfilCliente;
      analysisData.timeline = parsedData.linhaTempo;
      analysisData.handoffs = parsedData.temasRecorrentes;
      analysisData.agentConduct = parsedData.conducaoGeral;
      analysisData.riskLevel = parsedData.saudeConta.risco_churn || 'LOW';
      analysisData.riskChurn = parsedData.saudeConta.risco_churn || 'LOW';
      analysisData.recommendedActions = parsedData.planoRetencao;
    } else {
      analysisData.executiveSummary = parsedData.resumoExecutivo.substring(0, 1000) || analysisText.substring(0, 500);
      analysisData.mainProblem = parsedData.problemaPrincipal;
      analysisData.timeline = parsedData.linhaDoTempo;
      analysisData.handoffs = parsedData.participacaoHandoffs;
      analysisData.agentConduct = parsedData.conducaoAtendimento;
      analysisData.riskLevel = parsedData.riscoOperacional.criticidadeGeral;
      analysisData.riskRecontact = parsedData.riscoOperacional.recontato.nivel;
      analysisData.riskDissatisfaction = parsedData.riscoOperacional.insatisfacao.nivel;
      analysisData.riskChurn = parsedData.riscoOperacional.churn.nivel;
      analysisData.recommendedActions = parsedData.acoesRecomendadas;
      analysisData.keyEvidences = parsedData.evidenciasChave;
    }

    const analysis = await prisma.analysis.create({
      data: analysisData
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

    const analyses = histories.map(h => h.analysis as any);

    const formatted = analyses.map(a => ({
      id: a.id,
      type: a.type,
      conversationId: a.conversationId,
      customerId: a.customerId,
      customerEmail: a.customerEmail,
      preview: a.fullAnalysisText?.substring(0, 200) || a.executiveSummary || 'Sem conteudo',
      executiveSummary: a.executiveSummary,
      riskLevel: a.riskLevel,
      tokensUsed: a.tokensUsed,
      mediaProcessed: a.mediaProcessed,
      processingTime: a.processingTime,
      createdAt: a.createdAt,
      conversation: {
        customerName: a.conversation?.customerName || a.customerEmail || 'Relatório de Histórico',
        customerEmail: a.conversation?.customerEmail || a.customerEmail,
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

    const analysis = history.analysis as any;

    res.json({
      id: analysis.id,
      type: analysis.type,
      conversationId: analysis.conversationId,
      customerId: analysis.customerId,
      customerEmail: analysis.customerEmail,
      analysisText: analysis.fullAnalysisText || analysis.executiveSummary,
      fullAnalysisText: analysis.fullAnalysisText,
      executiveSummary: analysis.executiveSummary,
      riskLevel: analysis.riskLevel,

      // Enviando todos os novos campos para o Frontend!
      mainProblem: analysis.mainProblem,
      timeline: analysis.timeline,
      handoffs: analysis.handoffs,
      agentConduct: analysis.agentConduct,
      recommendedActions: analysis.recommendedActions,
      keyEvidences: analysis.keyEvidences,

      metadata: {
        tokensUsed: analysis.tokensUsed,
        mediaProcessed: analysis.mediaProcessed,
        processingTimeMs: analysis.processingTime
      },
      conversation: {
        customerName: analysis.conversation?.customerName,
        customerEmail: analysis.conversation?.customerEmail,
        assignedAgentName: analysis.conversation?.assignedAgentName,
        status: analysis.conversation?.status
      }
    });
  });

  delete = catchAsync(async (req: Request & { userId?: string }, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = req.userId!;

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

    const history = await prisma.analysisHistory.findFirst({
      where: { analysisId: id, userId },
      include: { analysis: true }
    });

    if (!history) {
      throw new AppError('Análise não encontrada no seu histórico', 404);
    }

    const conversationId = history.analysis.conversationId;

    await prisma.analysis.delete({ where: { id } });

    res.json({
      message: 'Analise removida. Gere uma nova analise.',
      conversationId: history.analysis.conversationId
    });
  });

  createBatch = catchAsync(async (req: Request & { userId?: string }, res: Response, next: NextFunction) => {
    await this.ensureJobsReady();

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

    const parsedData = geminiService.parseStructuredAnalysis(analysisText);

    return await prisma.analysis.create({
      data: {
        conversationId: conversation.id,
        executiveSummary: parsedData.resumoExecutivo.substring(0, 500) || analysisText.substring(0, 500),
        fullAnalysisText: analysisText,

        mainProblem: parsedData.problemaPrincipal as any,
        timeline: parsedData.linhaDoTempo,
        handoffs: parsedData.participacaoHandoffs,
        agentConduct: parsedData.conducaoAtendimento,

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

  getCacheStats = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const stats = await cacheService.getCacheStats();
    res.json(stats);
  });

  cleanCache = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await cacheService.cleanExpiredCache();
    res.json({ message: 'Cache limpo com sucesso' });
  });
}
