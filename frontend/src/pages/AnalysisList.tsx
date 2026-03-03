import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Eye, Hash, Mail, Sparkles, Filter, MoreVertical, Search as SearchIcon, Calendar } from 'lucide-react';
import { Loading } from '../components/Common/Loading';
import { analysisService } from '../services/analysis.service';
import { parseAnalysisText } from '../utils/analysisParser';

type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const extractRiskFromText = (text: string): RiskLevel | null => {
  const normalized = normalizeText(text);

  if (normalized.includes('criticidade geral: critico') || normalized.includes('risco de recontato: critico')) {
    return 'CRITICAL';
  }

  if (normalized.includes('criticidade geral: alto') || normalized.includes('risco de recontato: alto')) {
    return 'HIGH';
  }

  if (normalized.includes('criticidade geral: medio') || normalized.includes('risco de recontato: medio')) {
    return 'MEDIUM';
  }

  if (normalized.includes('criticidade geral: baixo') || normalized.includes('risco de recontato: baixo')) {
    return 'LOW';
  }

  return null;
};

const getDisplayRiskLevel = (analysis: any): RiskLevel => {
  const candidateText = `${analysis.executiveSummary || ''}\n${analysis.preview || ''}`;
  const parsed = extractRiskFromText(candidateText);

  if (parsed) return parsed;
  if (analysis.riskLevel === 'CRITICAL' || analysis.riskLevel === 'HIGH' || analysis.riskLevel === 'MEDIUM') {
    return analysis.riskLevel;
  }

  return 'LOW';
};

const getAnalysisPreview = (analysis: any) => {
  const candidates = [analysis.executiveSummary, analysis.preview].filter(
    (candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0
  );

  for (const candidate of candidates) {
    const parsed = parseAnalysisText(candidate);
    if (parsed.resumo_executivo && !parsed._raw_text) {
      return parsed.resumo_executivo;
    }
  }

  return analysis.executiveSummary || analysis.preview || 'Nenhum preview de texto disponível para esta análise de atendimento.';
};

const getRiskBadgeClass = (riskLevel: RiskLevel) => {
  if (riskLevel === 'CRITICAL') return 'bg-red-50 text-red-700 border-red-100 shadow-sm';
  if (riskLevel === 'HIGH') return 'bg-orange-50 text-orange-700 border-orange-100 shadow-sm';
  if (riskLevel === 'MEDIUM') return 'bg-yellow-50 text-yellow-700 border-yellow-100 shadow-sm';
  return 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-sm';
};

const getRiskBadgeLabel = (riskLevel: RiskLevel) => {
  if (riskLevel === 'CRITICAL') return 'Crítico';
  if (riskLevel === 'HIGH') return 'Alto';
  if (riskLevel === 'MEDIUM') return 'Médio';
  return 'Baixo';
};

export const AnalysisList = () => {
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const navigate = useNavigate();

  const formatConversationId = (conversationId?: string) => {
    if (!conversationId) return 'N/A';
    return conversationId.length > 18 ? `${conversationId.slice(0, 18)}...` : conversationId;
  };

  useEffect(() => {
    void loadAnalyses();
  }, []);

  const loadAnalyses = async () => {
    try {
      const data = await analysisService.list();
      setAnalyses(data);
    } catch {
      console.error('Erro ao carregar análises');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('Tem certeza que deseja deletar esta análise?')) return;

    setDeleting(id);
    try {
      await analysisService.delete(id);
      setAnalyses((prev) => prev.filter((analysis) => analysis.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao deletar análise');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="absolute inset-0 overflow-y-auto bg-surface-50">
      <div className="mx-auto max-w-6xl px-6 py-10 sm:px-8">
        <div className="mb-8 flex flex-col justify-between gap-6 animate-fade-in md:flex-row md:items-end">
          <div className="flex-1">
            <h1 className="flex items-center gap-3 text-3xl font-display font-bold text-surface-900">
              <Sparkles className="h-8 w-8 text-brand-500" />
              Histórico de Análises
            </h1>
            <p className="mt-2 max-w-xl text-sm text-surface-500">
              Acompanhe todas as análises de atendimento feitas pela IA. Filtre e busque por risco, cliente ou data para encontrar insights rapidamente.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="card-glass flex items-center gap-2 border border-surface-200 px-4 py-2.5 text-sm font-medium text-surface-600 shadow-sm">
              <span className="h-2.5 w-2.5 animate-pulse-slow rounded-full bg-brand-500"></span>
              {analyses.length} análise{analyses.length !== 1 && 's'} gerada{analyses.length !== 1 && 's'}
            </div>
            <button onClick={() => navigate('/search')} className="btn btn-primary">
              + Nova Análise
            </button>
          </div>
        </div>

        <div className="mb-8 flex flex-col items-center gap-4 animate-slide-up sm:flex-row" style={{ animationDelay: '100ms' }}>
          <div className="relative w-full flex-1">
            <SearchIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              placeholder="Buscar por cliente, email ou ID da conversa..."
              className="input h-11 bg-white pl-10 shadow-sm"
              disabled
            />
          </div>
          <div className="flex w-full items-center gap-3 sm:w-auto">
            <button className="btn btn-secondary h-11 bg-white px-4 text-surface-500 shadow-sm hover:text-surface-700">
              <Filter className="mr-2 h-4 w-4" />
              Filtros
            </button>
            <button className="btn btn-secondary h-11 bg-white px-4 text-surface-500 shadow-sm hover:text-surface-700">
              <Calendar className="mr-2 h-4 w-4" />
              Período
            </button>
          </div>
        </div>

        {analyses.length === 0 ? (
          <div className="card-glass flex flex-col items-center justify-center px-4 py-20 text-center animate-slide-up" style={{ animationDelay: '200ms' }}>
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 shadow-soft">
              <Sparkles className="h-10 w-10 text-brand-400" />
            </div>
            <h3 className="mb-2 text-xl font-display font-medium text-surface-900">Nenhuma análise disponível</h3>
            <p className="mb-6 max-w-sm text-surface-500">
              Você ainda não realizou nenhuma análise com IA. Inicie uma nova busca para gerar a primeira.
            </p>
            <button
              onClick={() => navigate('/search')}
              className="btn bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-brand-500 via-indigo-500 to-brand-600 text-white shadow-soft shadow-brand-500/30"
            >
              Começar Agora
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {analyses.map((analysis, index) => {
              const displayRiskLevel = getDisplayRiskLevel(analysis);
              const delay = Math.min((index + 2) * 100, 800);

              return (
                <div
                  key={analysis.id}
                  onClick={() => navigate(`/analysis/${analysis.id}`)}
                  className="card-glass-hover group isolation-auto flex h-full cursor-pointer flex-col bg-white animate-slide-up"
                  style={{ animationDelay: `${delay}ms` }}
                >
                  <div className="relative flex items-start justify-between border-b border-surface-100 p-5">
                    <div className="flex items-center gap-3 truncate">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 font-display font-bold text-white shadow-soft">
                        {(analysis.conversation?.customerName || analysis.conversation?.customerEmail || '?')[0].toUpperCase()}
                      </div>
                      <div className="truncate">
                        <p className="truncate pr-4 text-sm font-semibold text-surface-900">
                          {analysis.conversation?.customerName || analysis.conversation?.customerEmail || 'Cliente Local'}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-surface-500">
                          Agente: {analysis.conversation?.assignedAgentName || 'N/A'}
                        </p>
                      </div>
                    </div>

                    <button className="absolute right-4 top-4 rounded-md p-1.5 text-surface-300 opacity-0 transition-colors group-hover:opacity-100 hover:bg-surface-100 hover:text-surface-600">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <p className="mb-4 line-clamp-3 flex-1 text-sm leading-relaxed text-surface-600">
                      {getAnalysisPreview(analysis)}
                    </p>

                    <div className="mb-4 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded border border-surface-100 bg-surface-50 px-2 py-1 text-[11px] font-medium text-surface-500">
                        <Hash className="h-3 w-3 text-surface-400" />
                        {formatConversationId(analysis.conversationId)}
                      </span>
                      {analysis.conversation?.customerEmail && (
                        <span className="inline-flex max-w-[150px] items-center gap-1.5 truncate rounded border border-surface-100 bg-surface-50 px-2 py-1 text-[11px] font-medium text-surface-500">
                          <Mail className="h-3 w-3 shrink-0 text-surface-400" />
                          <span className="truncate">{analysis.conversation.customerEmail}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t border-surface-100 bg-surface-50/50 px-5 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400">Data e Hora</span>
                      <span className="flex items-center gap-1.5 text-xs font-medium text-surface-600">
                        <Calendar className="h-3.5 w-3.5 text-surface-400" />
                        {new Date(analysis.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} •{' '}
                        {new Date(analysis.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`badge flex items-center gap-1.5 border px-2.5 py-1 ${getRiskBadgeClass(displayRiskLevel)}`}>
                        <div className={`h-1.5 w-1.5 rounded-full bg-current ${displayRiskLevel === 'CRITICAL' ? 'animate-pulse' : ''}`}></div>
                        {getRiskBadgeLabel(displayRiskLevel)}
                      </span>

                      <div className="flex items-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/analysis/${analysis.id}`);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-600 transition-colors hover:bg-brand-50"
                          title="Ver análise completa"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(analysis.id, e)}
                          disabled={deleting === analysis.id}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50"
                          title="Deletar análise"
                        >
                          {deleting === analysis.id ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div>
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
