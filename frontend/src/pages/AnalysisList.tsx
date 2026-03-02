import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { analysisService } from '../services/analysis.service';
import { Loading } from '../components/Common/Loading';
import { Trash2, Eye, Hash, Mail, Sparkles, Filter, MoreVertical, Search as SearchIcon, Calendar } from 'lucide-react';

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
  const candidateText = `${analysis.preview || ''}\n${analysis.executiveSummary || ''}`;
  const parsed = extractRiskFromText(candidateText);

  if (parsed) return parsed;
  if (analysis.riskLevel === 'CRITICAL' || analysis.riskLevel === 'HIGH' || analysis.riskLevel === 'MEDIUM') {
    return analysis.riskLevel;
  }

  return 'LOW';
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

const getRiskIconColor = (riskLevel: RiskLevel) => {
  if (riskLevel === 'CRITICAL') return 'text-red-500';
  if (riskLevel === 'HIGH') return 'text-orange-500';
  if (riskLevel === 'MEDIUM') return 'text-yellow-500';
  return 'text-emerald-500';
}

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
      setAnalyses((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao deletar análise');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="absolute inset-0 bg-surface-50 overflow-y-auto">
      <div className="max-w-6xl mx-auto py-10 px-6 sm:px-8">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 animate-fade-in">
          <div className="flex-1">
            <h1 className="text-3xl font-display font-bold text-surface-900 flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-brand-500" />
              Histórico de Análises
            </h1>
            <p className="text-surface-500 mt-2 text-sm max-w-xl">
              Acompanhe todas as análises de atendimento feitas pela IA. Filtre e busque por risco, cliente ou data para encontrar insights rapidamente.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="card-glass border border-surface-200 px-4 py-2.5 flex items-center gap-2 text-sm font-medium text-surface-600 shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-pulse-slow"></span>
              {analyses.length} análise{analyses.length !== 1 && 's'} gerada{analyses.length !== 1 && 's'}
            </div>
            <button
              onClick={() => navigate('/search')}
              className="btn btn-primary"
            >
              + Nova Análise
            </button>
          </div>
        </div>

        {/* Toolbar & Filters (Visual Only) */}
        <div className="mb-8 flex flex-col sm:flex-row items-center gap-4 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="relative flex-1 w-full">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input
              type="text"
              placeholder="Buscar por cliente, email ou ID da conversa..."
              className="input pl-10 h-11 bg-white shadow-sm"
              disabled
            />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button className="btn btn-secondary h-11 px-4 text-surface-500 hover:text-surface-700 bg-white shadow-sm">
              <Filter className="w-4 h-4 mr-2" />
              Filtros
            </button>
            <button className="btn btn-secondary h-11 px-4 text-surface-500 hover:text-surface-700 bg-white shadow-sm">
              <Calendar className="w-4 h-4 mr-2" />
              Período
            </button>
          </div>
        </div>

        {/* Content Area */}
        {analyses.length === 0 ? (
          <div className="card-glass flex flex-col items-center justify-center py-20 px-4 text-center animate-slide-up" style={{ animationDelay: '200ms' }}>
            <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mb-6 shadow-soft">
              <Sparkles className="w-10 h-10 text-brand-400" />
            </div>
            <h3 className="text-xl font-display font-medium text-surface-900 mb-2">Nenhuma análise disponível</h3>
            <p className="text-surface-500 max-w-sm mb-6">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {analyses.map((analysis, index) => {
              const displayRiskLevel = getDisplayRiskLevel(analysis);
              const delay = Math.min((index + 2) * 100, 800);

              return (
                <div
                  key={analysis.id}
                  onClick={() => navigate(`/analysis/${analysis.id}`)}
                  className="card-glass-hover bg-white flex flex-col h-full animate-slide-up cursor-pointer group isolation-auto"
                  style={{ animationDelay: `${delay}ms` }}
                >
                  {/* Card Header */}
                  <div className="p-5 border-b border-surface-100 flex items-start justify-between relative">
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold font-display shadow-soft shrink-0">
                        {(analysis.conversation?.customerName || analysis.conversation?.customerEmail || '?')[0].toUpperCase()}
                      </div>
                      <div className="truncate">
                        <p className="font-semibold text-surface-900 text-sm truncate pr-4">
                          {analysis.conversation?.customerName || analysis.conversation?.customerEmail || 'Cliente Local'}
                        </p>
                        <p className="text-xs text-surface-500 truncate mt-0.5">
                          Agente: {analysis.conversation?.assignedAgentName || 'N/A'}
                        </p>
                      </div>
                    </div>

                    <button className="p-1.5 text-surface-300 hover:text-surface-600 rounded-md hover:bg-surface-100 transition-colors absolute right-4 top-4 opacity-0 group-hover:opacity-100 z-10">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 flex-1 flex flex-col">
                    <p className="text-sm text-surface-600 line-clamp-3 mb-4 flex-1 leading-relaxed">
                      {analysis.preview || analysis.executiveSummary || 'Nenhum preview de texto disponível para esta análise de atendimento.'}
                    </p>

                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-surface-50 border border-surface-100 text-[11px] font-medium text-surface-500">
                        <Hash className="w-3 h-3 text-surface-400" />
                        {formatConversationId(analysis.conversationId)}
                      </span>
                      {analysis.conversation?.customerEmail && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-surface-50 border border-surface-100 text-[11px] font-medium text-surface-500 truncate max-w-[150px]">
                          <Mail className="w-3 h-3 text-surface-400 shrink-0" />
                          <span className="truncate">{analysis.conversation.customerEmail}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="px-5 py-4 border-t border-surface-100 bg-surface-50/50 flex flex-wrap items-center justify-between gap-3 rounded-b-2xl">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-surface-400">Data e Hora</span>
                      <span className="text-xs font-medium text-surface-600 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-surface-400" />
                        {new Date(analysis.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} • {' '}
                        {new Date(analysis.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`badge border px-2.5 py-1 ${getRiskBadgeClass(displayRiskLevel)} flex items-center gap-1.5`}>
                        <div className={`w-1.5 h-1.5 rounded-full bg-current ${displayRiskLevel === 'CRITICAL' ? 'animate-pulse' : ''}`}></div>
                        {getRiskBadgeLabel(displayRiskLevel)}
                      </span>

                      <div className="flex items-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/analysis/${analysis.id}`);
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-brand-600 hover:bg-brand-50 transition-colors"
                          title="Ver análise completa"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={e => handleDelete(analysis.id, e)}
                          disabled={deleting === analysis.id}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                          title="Deletar análise"
                        >
                          {deleting === analysis.id ? (
                            <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <Trash2 className="w-4 h-4" />
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
