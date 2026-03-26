import api from './api';

type AnalysisJobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

interface AnalysisJobResponse {
  jobId: string;
  status: AnalysisJobStatus;
  progress: number;
  message: string;
}

interface AnalysisJobStatusResponse {
  id: string;
  status: AnalysisJobStatus;
  progress: number;
  message: string;
  analysisId?: string;
  error?: string;
}

export const analysisService = {
  async createJob(data: { conversationIds: string[], analysisType?: 'individual' | 'history' }): Promise<AnalysisJobResponse> {
    const { data: result } = await api.post('/analyses', data);
    return result;
  },

  async getJobStatus(jobId: string): Promise<AnalysisJobStatusResponse> {
    const { data } = await api.get(`/analyses/jobs/${jobId}`);
    return data;
  },

  async waitForJob(jobId: string, timeoutMs = 10 * 60 * 1000, intervalMs = 1500) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const status = await analysisService.getJobStatus(jobId);

      if (status.status === 'COMPLETED' && status.analysisId) {
        return status;
      }

      if (status.status === 'FAILED') {
        throw new Error(status.error || 'Falha ao processar analise');
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error('Tempo limite excedido aguardando analise');
  },

  async create(data: { conversationIds: string[], analysisType?: 'individual' | 'history' }) {
    const job = await analysisService.createJob(data);
    const completed = await analysisService.waitForJob(job.jobId);
    return analysisService.getById(completed.analysisId!);
  },

  async createBatch(conversationIds: string[]) {
    const { data } = await api.post('/analyses/batch', { conversationIds });
    return data;
  },

  async list() {
    const { data } = await api.get('/analyses');
    return data;
  },

  async getById(id: string) {
    const { data } = await api.get(`/analyses/${id}`);
    return {
      ...data,
      analysisText: data.fullAnalysisText || data.analysisText || data.executiveSummary || ''
    };
  },

  // ✅ P0.2 - Rota unificada DELETE /analyses/:id
  async delete(id: string) {
    const { data } = await api.delete(`/analyses/${id}`);
    return data;
  },

  // Manter método legado para compatibilidade
  async reanalyze(id: string) {
    const { data } = await api.delete(`/analyses/${id}/reanalyze`);
    return data;
  }
};
