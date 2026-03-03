import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
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
  TrendingUp,
  Share2,
  ListOrdered,
  Sparkles,
  FileText,
  CheckSquare,
  Paperclip,
} from 'lucide-react';
import { analysisService } from '../services/analysis.service';
import { parseAnalysisText, type ParsedAnalysisText } from '../utils/analysisParser';
import { ActivityOverlay } from '../components/Common/ActivityOverlay';

interface AnalysisConversationInfo {
  conversationId?: string;
  customerName?: string;
  customerEmail?: string;
}

type StructuredAnalysis = ParsedAnalysisText;

export const AnalysisView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<StructuredAnalysis | null>(null);
  const [conversationInfo, setConversationInfo] = useState<AnalysisConversationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Navigation State
  const [activeSection, setActiveSection] = useState<string>('resumo');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;

    const loadAnalysis = async (analysisId: string) => {
      try {
        const data = await analysisService.getById(analysisId);
        const text = data.analysisText || data.fullAnalysisText || '';

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

  const handleExportPdf = async () => {
    if (!analysis || typeof window === 'undefined') return;

    type PdfLine = {
      text: string;
      indent?: number;
      bold?: boolean;
      gapBefore?: number;
    };

    type PdfSection = {
      title: string;
      lines: PdfLine[];
    };

    const exportTitle = [
      'analise',
      customerDisplayName,
      conversationInfo?.conversationId
    ]
      .filter(Boolean)
      .join('-')
      .replace(/[^\w.-]+/g, '_');

    const normalizeText = (value: unknown): string =>
      String(value ?? '')
        .replace(/\r/g, '')
        .replace(/[ \t]+/g, ' ')
        .trim();

    const paragraphLines = (text: string, indent = 0, prefix = ''): PdfLine[] =>
      text
        .split(/\n+/)
        .map((part) => normalizeText(part))
        .filter(Boolean)
        .map((part, index) => ({
          text: `${index === 0 ? prefix : ''}${part}`,
          indent,
          gapBefore: index > 0 ? 1.5 : 0,
        }));

    const buildPdfLines = (value: unknown, indent = 0): PdfLine[] => {
      if (value === null || value === undefined || value === '') {
        return [{ text: 'N/A', indent }];
      }

      if (typeof value === 'string') {
        return paragraphLines(value, indent);
      }

      if (typeof value === 'number' || typeof value === 'boolean') {
        return [{ text: String(value), indent }];
      }

      if (Array.isArray(value)) {
        return value.flatMap((item, index) => {
          if (item === null || item === undefined || item === '') return [];
          if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
            return paragraphLines(String(item), indent, '- ');
          }

          return [
            { text: `Item ${index + 1}`, indent, bold: true, gapBefore: index > 0 ? 2 : 0 },
            ...buildPdfLines(item, indent + 1),
          ];
        });
      }

      if (typeof value === 'object') {
        return Object.entries(value as Record<string, unknown>).flatMap(([key, item], index) => {
          const label = formatKeyLabel(key);
          if (item === null || item === undefined || item === '') {
            return [{ text: `${label}: N/A`, indent, gapBefore: index > 0 ? 1.5 : 0 }];
          }

          if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
            return paragraphLines(`${label}: ${String(item)}`, indent).map((line, lineIndex) => ({
              ...line,
              gapBefore: lineIndex === 0 && index > 0 ? 1.5 : line.gapBefore,
            }));
          }

          return [
            { text: `${label}:`, indent, bold: true, gapBefore: index > 0 ? 1.5 : 0 },
            ...buildPdfLines(item, indent + 1),
          ];
        });
      }

      return [{ text: String(value), indent }];
    };

    setIsExportingPdf(true);

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginX = 14;
      const topMargin = 16;
      const bottomMargin = 14;
      const contentWidth = pageWidth - marginX * 2;
      const lineHeight = 4.6;
      const sectionSpacing = 7;
      const indentWidth = 5;
      let cursorY = topMargin;

      const ensureSpace = (neededHeight: number) => {
        if (cursorY + neededHeight <= pageHeight - bottomMargin) return;
        pdf.addPage();
        cursorY = topMargin;
      };

      const writeWrappedLine = (line: PdfLine) => {
        const indent = (line.indent || 0) * indentWidth;
        const x = marginX + indent;
        const maxWidth = contentWidth - indent;
        const wrapped = pdf.splitTextToSize(line.text, maxWidth) as string[];

        if (line.gapBefore) {
          cursorY += line.gapBefore;
        }

        ensureSpace(wrapped.length * lineHeight);
        pdf.setFont('helvetica', line.bold ? 'bold' : 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(51, 65, 85);
        pdf.text(wrapped, x, cursorY);
        cursorY += wrapped.length * lineHeight;
      };

      const drawHeader = () => {
        const cardHeight = 28;
        ensureSpace(cardHeight);
        pdf.setDrawColor(226, 232, 240);
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(marginX, cursorY, contentWidth, cardHeight, 3, 3, 'FD');

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(18);
        pdf.setTextColor(15, 23, 42);
        pdf.text(customerDisplayName, marginX + 4, cursorY + 8);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(71, 85, 105);
        pdf.text(`Email: ${conversationInfo?.customerEmail || 'Sem email'}`, marginX + 4, cursorY + 15);
        pdf.text(`Conversa: ${conversationInfo?.conversationId || 'N/A'}`, marginX + 4, cursorY + 20);
        pdf.text(
          `Exportado em: ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())}`,
          marginX + 4,
          cursorY + 25
        );

        cursorY += cardHeight + 8;
      };

      const drawSection = (section: PdfSection) => {
        ensureSpace(12);
        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(marginX, cursorY, contentWidth, 10, 2.5, 2.5, 'FD');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(15, 23, 42);
        pdf.text(section.title, marginX + 4, cursorY + 6.5);
        cursorY += 15;

        section.lines.forEach(writeWrappedLine);
        cursorY += sectionSpacing;
      };

      const pdfSections: PdfSection[] = [];

      if (analysis._raw_text) {
        pdfSections.push({
          title: 'Texto Original da Analise',
          lines: buildPdfLines(analysis._raw_text),
        });
      } else {
        if (analysis.resumo_executivo) {
          pdfSections.push({
            title: 'Resumo Executivo',
            lines: buildPdfLines(analysis.resumo_executivo),
          });
        }

        if (analysis.linha_do_tempo) {
          pdfSections.push({
            title: 'Linha do Tempo',
            lines: buildPdfLines(analysis.linha_do_tempo),
          });
        }

        if (Object.keys(problema).length > 0) {
          pdfSections.push({
            title: 'Diagnostico do Caso',
            lines: buildPdfLines(problema),
          });
        }

        if (Object.keys(participacao).length > 0) {
          pdfSections.push({
            title: 'Participacao e Handoffs',
            lines: buildPdfLines(participacao),
          });
        }

        if (Object.keys(conducao).length > 0) {
          pdfSections.push({
            title: 'Conducao do Atendimento',
            lines: buildPdfLines(conducao),
          });
        }

        if (Object.keys(avaliacao).length > 0) {
          const avaliacaoLines: PdfLine[] = [];
          if (avaliacaoScoreTotal !== null && avaliacaoScoreTotal !== undefined) {
            avaliacaoLines.push({ text: `Score Total: ${avaliacaoScoreTotal}/12`, bold: true });
            avaliacaoLines.push({ text: '', gapBefore: 1 });
          }

          avaliacaoLines.push(...buildPdfLines(avaliacao));
          pdfSections.push({
            title: 'Avaliacao Padronizada (QA)',
            lines: avaliacaoLines.filter((line) => line.text !== '' || line.gapBefore),
          });
        }

        if (Object.keys(risco).length > 0) {
          pdfSections.push({
            title: 'Analise de Risco',
            lines: buildPdfLines(risco),
          });
        }

        if (Array.isArray(acoesRecomendadas) && acoesRecomendadas.length > 0) {
          pdfSections.push({
            title: 'Planos de Acao Recomendados',
            lines: buildPdfLines(acoesRecomendadas),
          });
        }

        if (Array.isArray(analysis.evidencias_chave) && analysis.evidencias_chave.length > 0) {
          pdfSections.push({
            title: 'Evidencias-Chave',
            lines: buildPdfLines(analysis.evidencias_chave),
          });
        }

        if (Array.isArray(anexos) && anexos.length > 0) {
          pdfSections.push({
            title: 'Midia Analisada',
            lines: buildPdfLines(anexos),
          });
        }
      }

      if (pdfSections.length === 0) {
        throw new Error('Nenhuma seção disponível para exportação.');
      }

      drawHeader();
      pdfSections.forEach(drawSection);

      const totalPages = pdf.getNumberOfPages();
      for (let page = 1; page <= totalPages; page += 1) {
        pdf.setPage(page);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(148, 163, 184);
        pdf.text(`Pagina ${page} de ${totalPages}`, pageWidth - marginX, pageHeight - 6, { align: 'right' });
      }

      pdf.save(`${exportTitle}.pdf`);
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      alert('Nao foi possivel exportar o PDF desta analise.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-surface-50">
        <ActivityOverlay
          open
          icon={FileText}
          title="Carregando análise"
          description="Buscando os dados processados e preparando a visualização detalhada."
          accentClassName="from-brand-500 via-violet-400 to-indigo-500"
        />
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
  const avaliacaoScoreTotal = avaliacao.score_total ?? avaliacao.scoreTotal;

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
      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand-600' : 'text-surface-400'}`} />
      <span className="truncate whitespace-nowrap">{label}</span>
      </button>
    );
  };

  return (
    <div className={`analysis-print-root min-h-screen bg-surface-50 ${isExportingPdf ? 'analysis-export-mode' : ''}`}>

      {/* Top Header */}
      <div className="bg-white border-b border-surface-200 sticky top-0 z-30 shadow-sm print-hidden">
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
            <button className="btn btn-secondary bg-white text-surface-700 shadow-sm print-hidden">
              <Share2 className="w-4 h-4 mr-2" />
              Compartilhar
            </button>
            <button
              onClick={handleExportPdf}
              className="btn btn-primary"
              disabled={isExportingPdf}
            >
              <Download className="w-4 h-4 mr-2" />
              {isExportingPdf ? 'Gerando PDF...' : 'Exportar PDF'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[90rem] mx-auto px-6 py-8 flex items-start gap-8 lg:flex-row-reverse">

        {/* Left Navigation Sidebar - Scroll Spy */}
        <div className="w-64 shrink-0 sticky top-28 hidden lg:block print-right-column">

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
        <div className="flex-1 min-w-0 analysis-main-column" ref={scrollContainerRef}>

          <div className="hidden print:block bg-white border border-surface-200 rounded-2xl p-6 mb-8">
            <h1 className="text-2xl font-display font-bold text-surface-900">{customerDisplayName}</h1>
            <div className="mt-3 space-y-1 text-sm text-surface-600">
              <p>Email: {conversationInfo?.customerEmail || 'Sem email'}</p>
              <p>Conversa: {conversationInfo?.conversationId || 'N/A'}</p>
            </div>
          </div>

          {/* If Raw Text Fallback */}
          {analysis._raw_text && (
            <div className="card-glass p-8 mb-8" data-pdf-section="true">
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
                <div id="section-resumo" className="card-glass overflow-hidden relative group" data-pdf-section="true">
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
                <div id="section-linha_tempo" className="card-glass p-8 scroll-mt-28" data-pdf-section="true">
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
                <div id="section-diagnostico" className="card-glass p-8 scroll-mt-28" data-pdf-section="true">
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
                <div id="section-participacao" className="card-glass p-8 scroll-mt-28" data-pdf-section="true">
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
                <div id="section-conducao" className="card-glass p-8 scroll-mt-28" data-pdf-section="true">
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
                <div id="section-avaliacao" className="card-glass p-8 scroll-mt-28 relative overflow-hidden" data-pdf-section="true">
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
                <div id="section-risco" className="card-glass p-8 scroll-mt-28" data-pdf-section="true">
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
                <div id="section-acoes" className="card-glass p-8 scroll-mt-28" data-pdf-section="true">
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
                <div id="section-evidencias" className="card-glass p-8 scroll-mt-28" data-pdf-section="true">
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
