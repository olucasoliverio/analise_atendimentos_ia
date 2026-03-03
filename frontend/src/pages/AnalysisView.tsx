import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  Hash,
  Mail,
  ShieldAlert,
  Target,
  Users,
  Calendar,
  TrendingUp,
  Share2,
  ListOrdered,
  Sparkles,
  FileText,
  Activity,
  CheckSquare,
  Paperclip,
  BellRing
} from 'lucide-react';
import { analysisService } from '../services/analysis.service';

interface AnalysisMetadata {
  tokensUsed?: number;
  mediaProcessed?: number;
  processingTimeMs?: number;
}

interface AnalysisConversationInfo {
  conversationId?: string;
  customerName?: string;
  customerEmail?: string;
}

interface StructuredAnalysis {
  resumo_executivo?: string;
  linha_do_tempo?: any;
  participacao_handoffs?: any;
  problema_principal?: any;
  conducao_atendimento?: any;
  avaliacao_padronizada?: any;
  analise_risco?: any;
  risco_operacional?: any;
  evidencias_chave?: any;
  anexos_analisados?: any;
  acoes_recomendadas?: any;
  notas_privadas?: any;
  [key: string]: any;
}

export const AnalysisView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<StructuredAnalysis | null>(null);
  const [metadata, setMetadata] = useState<AnalysisMetadata | null>(null);
  const [conversationInfo, setConversationInfo] = useState<AnalysisConversationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Navigation State
  const [activeSection, setActiveSection] = useState<string>('resumo');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;

    const loadAnalysis = async (analysisId: string) => {
      try {
        const data = await analysisService.getById(analysisId);
        const text = data.analysisText || data.fullAnalysisText || '';

        setMetadata(data.metadata || null);
        setConversationInfo({
          conversationId: data.conversationId,
          customerName: data.conversation?.customerName,
          customerEmail: data.conversation?.customerEmail
        });

        const parsed = parseAnalysisText(text);
        setAnalysis(parsed);
      } catch (err) {
        console.error('❌ Erro ao carregar:', err);
        setError('Erro ao carregar análise');
      } finally {
        setLoading(false);
      }
    };

    void loadAnalysis(id);
  }, [id]);

  // Scroll Spy Logic
  useEffect(() => {
    const handleScroll = () => {
      if (!scrollContainerRef.current) return;

      const sections = ['resumo', 'linha_tempo', 'diagnostico', 'participacao', 'conducao', 'avaliacao', 'risco', 'acoes', 'evidencias'];
      const scrollPosition = document.documentElement.scrollTop || document.body.scrollTop;

      for (const section of sections) {
        const element = document.getElementById(`section-${section}`);
        if (element) {
          const { top, bottom } = element.getBoundingClientRect();
          if (top <= 200 && bottom > 200) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(`section-${sectionId}`);
    if (element) {
      window.scrollTo({
        top: element.offsetTop - 100,
        behavior: 'smooth'
      });
      setActiveSection(sectionId);
    }
  };

  const normalizeAnalysisKeys = (parsed: StructuredAnalysis): StructuredAnalysis => ({
    ...parsed,
    resumo_executivo: parsed.resumo_executivo ?? parsed.resumoExecutivo,
    linha_do_tempo: parsed.linha_do_tempo ?? parsed.linhaDoTempo,
    participacao_handoffs: parsed.participacao_handoffs ?? parsed.participacaoHandoffs,
    problema_principal: parsed.problema_principal ?? parsed.problemaPrincipal,
    conducao_atendimento: parsed.conducao_atendimento ?? parsed.conducaoAtendimento,
    avaliacao_padronizada: parsed.avaliacao_padronizada ?? parsed.avaliacaoPadronizada,
    analise_risco: parsed.analise_risco ?? parsed.analiseRisco,
    risco_operacional: parsed.risco_operacional ?? parsed.riscoOperacional,
    evidencias_chave: parsed.evidencias_chave ?? parsed.evidenciasChave,
    anexos_analisados: parsed.anexos_analisados ?? parsed.anexosAnalisados,
    acoes_recomendadas: parsed.acoes_recomendadas ?? parsed.acoesRecomendadas,
    notas_privadas: parsed.notas_privadas ?? parsed.notasPrivadas ?? parsed.notas_privadas_acoes_criticas
  });

  const sanitizeJsonCandidate = (input: string): string =>
    input
      .replace(/^\uFEFF/, '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/,\s*([}\]])/g, '$1');

  const extractJsonCandidate = (text: string): string => {
    const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fencedMatch?.[1]) return fencedMatch[1].trim();

    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return text.slice(firstBrace, lastBrace + 1).trim();
    }

    return text;
  };

  const tryParseJson = (candidate: string): StructuredAnalysis | null => {
    try {
      const parsed = JSON.parse(candidate);

      if (typeof parsed === 'string') {
        const nested = parsed.trim();
        if (nested.startsWith('{')) {
          const parsedNested = JSON.parse(nested) as StructuredAnalysis;
          return parsedNested;
        }
        return { resumo_executivo: nested };
      }

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as StructuredAnalysis;
      }
    } catch {
      return null;
    }

    return null;
  };

  const parseAnalysisText = (text: string): StructuredAnalysis => {
    const cleaned = text.trim();
    if (!cleaned) return {};

    const extracted = extractJsonCandidate(cleaned);
    const candidates = [cleaned, extracted].filter(
      (candidate, index, all) => candidate.length > 0 && all.indexOf(candidate) === index
    );

    for (const candidate of candidates) {
      const variants = [candidate, sanitizeJsonCandidate(candidate)];
      for (const variant of variants) {
        const parsed = tryParseJson(variant);
        if (parsed) {
          return normalizeAnalysisKeys(parsed);
        }
      }
    }

    return {
      resumo_executivo: 'Não foi possível estruturar automaticamente esta análise.',
      _raw_text: cleaned
    };
  };

  const getRiskColor = (level: string) => {
    const normalized = level?.toUpperCase() || '';
    if (normalized.includes('CRIT')) return 'bg-red-50 text-red-700 border-red-200';
    if (normalized.includes('ALTO') || normalized === 'HIGH') return 'bg-orange-50 text-orange-700 border-orange-200';
    if (normalized.includes('MED') || normalized.includes('MÉD')) return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  };

  const getRiskIcon = (level: string) => {
    const normalized = level?.toUpperCase() || '';
    if (normalized.includes('CRIT')) return <ShieldAlert className="w-5 h-5 text-red-600" />;
    if (normalized.includes('ALTO')) return <AlertTriangle className="w-5 h-5 text-orange-600" />;
    if (normalized.includes('MED') || normalized.includes('MÉD')) return <AlertCircle className="w-5 h-5 text-yellow-600" />;
    return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
  };

  const formatRiskLabel = (level: string): string => {
    const normalized = level?.toUpperCase() || '';
    if (normalized.includes('CRIT')) return 'CRÍTICO';
    if (normalized.includes('ALTO') || normalized === 'HIGH') return 'ALTO';
    if (normalized.includes('MED') || normalized.includes('MÉD')) return 'MÉDIO';
    if (normalized.includes('BAIXO') || normalized === 'LOW') return 'BAIXO';
    return level || 'N/A';
  };

  const formatKeyLabel = (key: string): string =>
    key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const customerDisplayName = conversationInfo?.customerName || conversationInfo?.customerEmail || 'Cliente';

  const escapeHtml = (value: string): string =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const formatValue = (value: unknown): React.ReactNode => {
    if (value === null || value === undefined || value === '') return <span className="text-surface-400">—</span>;
    if (Array.isArray(value)) {
      return (
        <ul className="list-disc list-inside space-y-1 mt-2">
          {value.map((item, idx) => <li key={idx} className="text-surface-700">{formatValue(item)}</li>)}
        </ul>
      );
    }
    if (typeof value === 'object') {
      return (
        <div className="space-y-3 mt-3">
          {Object.entries(value as Record<string, unknown>).map(([key, item], idx) => (
            <div key={idx} className="bg-surface-50 p-3 rounded-lg border border-surface-100">
              <strong className="block text-xs uppercase tracking-wider text-surface-500 mb-1">{formatKeyLabel(key)}</strong>
              <div className="text-surface-800 text-sm">{formatValue(item)}</div>
            </div>
          ))}
        </div>
      );
    }
    return <span className="text-surface-800">{String(value)}</span>;
  };

  const handleExportPdf = () => {
    if (!analysis) return;
    alert("Export PDF Function is currently under refactoring.");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-surface-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-soft flex items-center justify-center relative overflow-hidden">
            <Sparkles className="w-8 h-8 text-brand-500 animate-pulse" />
            <div className="absolute inset-0 bg-gradient-to-tr from-brand-50 to-transparent opacity-50"></div>
          </div>
          <p className="text-surface-500 font-medium animate-pulse">Carregando análise...</p>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-6">
        <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-xl flex items-center gap-4">
          <AlertCircle className="w-8 h-8 text-red-500 shrink-0" />
          <div>
            <h3 className="font-bold mb-1">Erro ao carregar</h3>
            <p>{error || 'Análise não encontrada no sistema.'}</p>
          </div>
        </div>
      </div>
    );
  }

  const risco = analysis.analise_risco || analysis.risco_operacional || {};
  const avaliacao = analysis.avaliacao_padronizada || {};
  const problema = analysis.problema_principal || {};
  const conducao = analysis.conducao_atendimento || {};
  const participacao = analysis.participacao_handoffs || {};
  const anexos = analysis.anexos_analisados;
  const acoesRecomendadas = analysis.acoes_recomendadas;
  const notasPrivadas = analysis.notas_privadas;
  const avaliacaoScoreTotal = avaliacao.score_total ?? avaliacao.scoreTotal;
  const avaliacaoClassificacao = avaliacao.classificacao ?? avaliacao.classificacao_geral ?? avaliacao.classificacaoGeral;

  const NavItem = ({ id, icon: Icon, label }: { id: string, icon: any, label: string }) => {
    const isActive = activeSection === id;

    // Check if section has data before rendering nav item
    const hasData = () => {
      if (id === 'resumo' && analysis.resumo_executivo) return true;
      if (id === 'linha_tempo' && analysis.linha_do_tempo) return true;
      if (id === 'diagnostico' && Object.keys(problema).length > 0) return true;
      if (id === 'participacao' && analysis.participacao_handoffs) return true;
      if (id === 'conducao' && Object.keys(conducao).length > 0) return true;
      if (id === 'avaliacao' && Object.keys(avaliacao).length > 0) return true;
      if (id === 'risco' && Object.keys(risco).length > 0) return true;
      if (id === 'acoes' && acoesRecomendadas?.length > 0) return true;
      if (id === 'evidencias' && analysis.evidencias_chave?.length > 0) return true;
      return false;
    };

    if (!hasData()) return null;

    return (
      <button
        onClick={() => scrollToSection(id)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive
            ? 'bg-brand-50 text-brand-700 shadow-sm'
            : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'
          }`}
      >
        <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-surface-400'}`} />
        {label}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-surface-50">

      {/* Top Header */}
      <div className="bg-white border-b border-surface-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate('/analyses')}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-50 text-surface-500 hover:bg-surface-100 hover:text-surface-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-display font-bold text-surface-900 flex items-center gap-2">
                {customerDisplayName}
              </h1>
              <div className="flex items-center gap-3 mt-1 text-xs text-surface-500 font-medium">
                <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {conversationInfo?.customerEmail || 'Sem email'}</span>
                <span className="text-surface-300">•</span>
                <span className="flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> {conversationInfo?.conversationId || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="btn btn-secondary bg-white text-surface-700 shadow-sm">
              <Share2 className="w-4 h-4 mr-2" />
              Compartilhar
            </button>
            <button
              onClick={handleExportPdf}
              className="btn btn-primary"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar PDF
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 flex items-start gap-8 lg:flex-row-reverse">

        {/* Left Navigation Sidebar - Scroll Spy */}
        <div className="w-64 shrink-0 sticky top-28 hidden lg:block">

          <div className="card-glass p-2">
            <div className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-surface-400">Navegação</div>
            <div className="space-y-1"> 
              <NavItem id="resumo" icon={FileText} label="Resumo Executivo" />
              <NavItem id="linha_tempo" icon={Clock} label="Linha do Tempo" />
              <NavItem id="diagnostico" icon={Target} label="Diagnóstico" />
              <NavItem id="participacao" icon={Users} label="Participação" />
              <NavItem id="conducao" icon={TrendingUp} label="Condução" />
              <NavItem id="avaliacao" icon={CheckSquare} label="Avaliação (QA)" />
              <NavItem id="risco" icon={ShieldAlert} label="Análise de Risco" />
              <NavItem id="acoes" icon={ListOrdered} label="Ações Recomendadas" />
              <NavItem id="evidencias" icon={Paperclip} label="Evidências" />
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0" ref={scrollContainerRef}>

          {/* If Raw Text Fallback */}
          {analysis._raw_text && (
            <div className="card-glass p-8 mb-8">
              <h2 className="text-xl font-display font-bold text-surface-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Texto Original da Análise
              </h2>
              <p className="text-sm text-surface-500 mb-6">Não foi possível processar a estrutura. Exibindo o texto original retornado pela inteligência artificial.</p>
              <pre className="whitespace-pre-wrap break-words text-sm text-surface-800 font-mono bg-surface-50 p-6 rounded-xl border border-surface-200">
                {analysis._raw_text}
              </pre>
            </div>
          )}

          {!analysis._raw_text && (
            <div className="space-y-8 pb-32">

              {/* Resumo Executivo */}
              {analysis.resumo_executivo && (
                <div id="section-resumo" className="card-glass overflow-hidden relative group">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-500"></div>
                  <div className="p-8">
                    <h2 className="text-xl font-display font-bold text-surface-900 mb-4 flex items-center gap-2">
                      <Sparkles className="w-6 h-6 text-brand-500" />
                      Resumo Executivo
                    </h2>
                    <p className="text-surface-700 leading-relaxed text-[15px]">
                      {analysis.resumo_executivo}
                    </p>
                  </div>
                </div>
              )}

              {/* Linha do Tempo */}
              {analysis.linha_do_tempo && (
                <div id="section-linha_tempo" className="card-glass p-8 scroll-mt-28">
                  <h2 className="text-xl font-display font-bold text-surface-900 mb-6 flex items-center gap-2">
                    <Clock className="w-6 h-6 text-indigo-500" />
                    Linha do Tempo
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(analysis.linha_do_tempo).map(([key, val]) => (
                      <div key={key} className="bg-surface-50 p-4 rounded-xl border border-surface-100">
                        <div className="text-xs font-bold uppercase tracking-wider text-surface-500 mb-1">{formatKeyLabel(key)}</div>
                        <div className="text-surface-900 font-medium">{formatValue(val)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Diagnóstico */}
              {problema && Object.keys(problema).length > 0 && (
                <div id="section-diagnostico" className="card-glass p-8 scroll-mt-28">
                  <h2 className="text-xl font-display font-bold text-surface-900 mb-6 flex items-center gap-2">
                    <Target className="w-6 h-6 text-rose-500" />
                    Diagnóstico do Caso
                  </h2>
                  <div className="space-y-6 animate-slide-up">
                    {Object.entries(problema).map(([key, val]) => (
                      <div key={key} className="border-b border-surface-100 pb-4 last:border-0 last:pb-0">
                        <h4 className="text-sm font-bold text-surface-900 mb-2">{formatKeyLabel(key)}</h4>
                        <div className="text-surface-700 text-sm leading-relaxed">{formatValue(val)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Participação */}
              {analysis.participacao_handoffs && (
                <div id="section-participacao" className="card-glass p-8 scroll-mt-28">
                  <h2 className="text-xl font-display font-bold text-surface-900 mb-6 flex items-center gap-2">
                    <Users className="w-6 h-6 text-sky-500" />
                    Participação e Handoffs
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries(participacao).map(([key, val]) => (
                      <div key={key} className="bg-white border border-surface-200 p-4 rounded-xl shadow-sm">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-surface-500 mb-3">{formatKeyLabel(key)}</h4>
                        <div className="text-surface-800 text-sm">{formatValue(val)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Condução */}
              {conducao && Object.keys(conducao).length > 0 && (
                <div id="section-conducao" className="card-glass p-8 scroll-mt-28">
                  <h2 className="text-xl font-display font-bold text-surface-900 mb-6 flex items-center gap-2">
                    <TrendingUp className="w-6 h-6 text-teal-500" />
                    Condução do Atendimento
                  </h2>
                  <div className="space-y-5">
                    {Object.entries(conducao).map(([key, val]) => (
                      <div key={key}>
                        <h4 className="text-sm font-bold text-surface-900 mb-2">{formatKeyLabel(key)}</h4>
                        <div className="text-surface-700 text-sm bg-surface-50 p-4 rounded-lg border border-surface-100">
                          {formatValue(val)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Avaliação Padronizada */}
              {avaliacao && Object.keys(avaliacao).length > 0 && (
                <div id="section-avaliacao" className="card-glass p-8 scroll-mt-28 relative overflow-hidden">
                  <h2 className="text-xl font-display font-bold text-surface-900 mb-6 flex items-center gap-2">
                    <CheckSquare className="w-6 h-6 text-violet-500" />
                    Avaliação Padronizada (QA)
                  </h2>

                  {avaliacaoScoreTotal !== null && avaliacaoScoreTotal !== undefined && (
                    <div className="absolute top-6 right-8 text-right">
                      <div className="text-3xl font-display font-bold text-violet-600">{avaliacaoScoreTotal}/12</div>
                      <div className="text-xs font-bold uppercase tracking-wider text-surface-400">Score Total</div>
                    </div>
                  )}

                  <div className="space-y-4 mt-8">
                    {Object.entries(avaliacao).map(([key, value]: [string, any]) => {
                      if (!value || typeof value !== 'object' || value.nota === null || value.nota === undefined) return null;

                      const label = formatKeyLabel(key);
                      const numericScore = Number(value.nota) || 0;
                      const percentage = (numericScore / 2) * 100;

                      return (
                        <div key={key} className="p-5 bg-white border border-surface-200 rounded-xl shadow-sm">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-bold text-surface-900">{label}</span>
                            <span className="text-sm font-bold bg-violet-50 text-violet-700 px-2 py-1 rounded">Nota: {numericScore}/2</span>
                          </div>
                          <div className="w-full bg-surface-100 rounded-full h-1.5 mb-4">
                            <div
                              className="bg-violet-500 h-1.5 rounded-full transition-all duration-1000 ease-out"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          {value.evidencia && (
                            <div className="text-sm text-surface-600 leading-relaxed bg-surface-50 p-3 rounded-lg">
                              <strong>Evidência:</strong> {value.evidencia}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Análise de Risco */}
              {risco && Object.keys(risco).length > 0 && (
                <div id="section-risco" className="card-glass p-8 scroll-mt-28">
                  <h2 className="text-xl font-display font-bold text-surface-900 mb-6 flex items-center gap-2">
                    <ShieldAlert className="w-6 h-6 text-red-500" />
                    Análise de Risco
                  </h2>

                  {(risco.criticidade_geral || risco.classificacao) && (
                    <div className={`px-6 py-4 rounded-xl mb-6 border inline-flex items-center gap-3 ${getRiskColor(risco.criticidade_geral || risco.classificacao)}`}>
                      {getRiskIcon(risco.criticidade_geral || risco.classificacao)}
                      <span className="font-bold text-lg">
                        Criticidade Geral: {formatRiskLabel(risco.criticidade_geral || risco.classificacao)}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries(risco).map(([key, val]: [string, any]) => {
                      if (key === 'criticidade_geral' || key === 'classificacao') return null;
                      if (!val) return null;

                      return (
                        <div key={key} className="bg-white border border-surface-200 p-5 rounded-xl shadow-sm">
                          <h4 className="text-sm font-bold text-surface-900 mb-3 capitalize">{formatKeyLabel(key)}</h4>
                          {typeof val === 'object' ? (
                            <>
                              {(val.nivel || val.status) && (
                                <span className={`badge border mb-3 ${getRiskColor(val.nivel || val.status)}`}>
                                  Nível: {formatRiskLabel(val.nivel || val.status)}
                                </span>
                              )}
                              {val.justificativa && (
                                <p className="text-sm text-surface-600 mt-2">{val.justificativa}</p>
                              )}
                            </>
                          ) : (
                            <div className="text-sm text-surface-700">{formatValue(val)}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Ações Recomendadas */}
              {acoesRecomendadas && Array.isArray(acoesRecomendadas) && acoesRecomendadas.length > 0 && (
                <div id="section-acoes" className="card-glass p-8 scroll-mt-28">
                  <h2 className="text-xl font-display font-bold text-surface-900 mb-6 flex items-center gap-2">
                    <ListOrdered className="w-6 h-6 text-emerald-500" />
                    Planos de Ação Recomendados
                  </h2>
                  <div className="space-y-4">
                    {acoesRecomendadas.map((acao: any, idx: number) => (
                      <div key={idx} className="bg-white border border-surface-200 rounded-xl p-6 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>

                        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                          {(acao.categoria || acao.categoria_acao) && (
                            <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200">
                              {acao.categoria || acao.categoria_acao}
                            </span>
                          )}
                          <div className="flex gap-2 text-xs font-medium">
                            {(acao.dono || acao.owner) && (
                              <span className="bg-surface-100 text-surface-600 px-2 py-1 rounded-md">
                                Dono: {acao.dono || acao.owner}
                              </span>
                            )}
                            {acao.prazo && (
                              <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded-md border border-amber-200">
                                Prazo: {acao.prazo}
                              </span>
                            )}
                          </div>
                        </div>

                        {(acao.o_que_fazer || acao.oQueFazer) && (
                          <p className="text-base font-bold text-surface-900 mb-2">
                            {acao.o_que_fazer || acao.oQueFazer}
                          </p>
                        )}

                        {(acao.exemplo_pratico || acao.exemploPratico) && (
                          <p className="text-sm text-surface-600 mb-4 bg-surface-50 p-3 rounded-lg inline-block">
                            💡 {acao.exemplo_pratico || acao.exemploPratico}
                          </p>
                        )}

                        {(acao.impacto_esperado || acao.impactoEsperado) && (
                          <p className="text-sm text-surface-500">
                            <strong className="text-surface-700">Impacto esperado:</strong> {acao.impacto_esperado || acao.impactoEsperado}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Evidências */}
              {analysis.evidencias_chave && Array.isArray(analysis.evidencias_chave) && analysis.evidencias_chave.length > 0 && (
                <div id="section-evidencias" className="card-glass p-8 scroll-mt-28">
                  <h2 className="text-xl font-display font-bold text-surface-900 mb-6 flex items-center gap-2">
                    <Paperclip className="w-6 h-6 text-surface-400" />
                    Evidências-Chave & Anexos
                  </h2>
                  <ul className="space-y-3">
                    {analysis.evidencias_chave.map((evidencia, idx) => (
                      <li key={idx} className="flex gap-3 text-surface-700 bg-white border border-surface-200 p-4 rounded-xl shadow-sm">
                        <div className="w-1.5 h-auto bg-surface-300 rounded-full shrink-0"></div>
                        <span className="text-sm leading-relaxed">
                          {typeof evidencia === 'string' ? evidencia : JSON.stringify(evidencia)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* Anexos */}
                  {anexos && Array.isArray(anexos) && anexos.length > 0 && (
                    <div className="mt-8 pt-8 border-t border-surface-200">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-surface-900 mb-4">Mídia Analisada</h3>
                      <ul className="space-y-2">
                        {anexos.map((item, idx) => (
                          <li key={idx} className="text-surface-600 bg-surface-50 p-3 rounded-lg text-sm font-mono border border-surface-200 break-words">
                            {typeof item === 'string' ? item : JSON.stringify(item)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
};
