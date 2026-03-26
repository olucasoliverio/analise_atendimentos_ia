import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { ProcessedMedia } from './media.service';

export type StructuredRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface StructuredAnalysisAction {
  oQueFazer: string;
  dono: string;
  prazo: string;
  impactoEsperado: string;
}

export interface StructuredAnalysisResult {
  resumoExecutivo: string;
  linhaDoTempo: Record<string, any>;
  participacaoHandoffs: Record<string, any>;
  problemaPrincipal: Record<string, any>;
  conducaoAtendimento: Record<string, any>;
  riscoOperacional: {
    recontato: { nivel: StructuredRiskLevel; justificativa: string };
    insatisfacao: { nivel: StructuredRiskLevel; justificativa: string };
    churn: { nivel: StructuredRiskLevel; justificativa: string };
    criticidadeGeral: StructuredRiskLevel;
    justificativaGeral: string;
  };
  acoesRecomendadas: StructuredAnalysisAction[];
  evidenciasChave: string[];
}

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  /**
   * ✅ OTIMIZADO - Gerar análise com compressão inteligente
   */
  async generateAnalysis(
    transcript: string,
    media: ProcessedMedia[],
    prompt: string
  ): Promise<string> {
    const estimatedTokens = this.estimateTokens(transcript, media.length);

    console.log(`📊 Tokens estimados: ${estimatedTokens.toLocaleString()}`);

    // ✅ ESTRATÉGIA 1: Conversa muito longa → resumir
    if (estimatedTokens > 50000) {
      console.log('⚠️ Conversa muito longa! Aplicando compressão inteligente...');
      return await this.generateFromCompressedTranscript(transcript, media, prompt);
    }

    // ✅ ESTRATÉGIA 2: Conversa normal → usar completa
    console.log('✅ Conversa dentro do limite, usando completa');
    return await this.generateFromFullTranscript(transcript, media, prompt);
  }

  /**
   * ✅ NOVO - Gerar análise de conversa comprimida
   */
  private async generateFromCompressedTranscript(
    transcript: string,
    media: ProcessedMedia[],
    prompt: string
  ): Promise<string> {
    console.log('🗜️ Comprimindo transcrição...');

    // Extrair mensagens relevantes
    const relevantMessages = this.extractRelevantMessages(transcript);
    const compressedTranscript = this.buildCompressedTranscript(relevantMessages);

    const tokensAfter = this.estimateTokens(compressedTranscript, media.length);
    const reduction = Math.round((1 - tokensAfter / this.estimateTokens(transcript, media.length)) * 100);

    console.log(`✅ Compressão: ${reduction}% de redução de tokens`);
    console.log(`📊 Tokens após compressão: ${tokensAfter.toLocaleString()}`);

    return await this.generateFromFullTranscript(compressedTranscript, media, prompt);
  }

  /**
   * ✅ NOVO - Extrair apenas mensagens relevantes
   */
  private extractRelevantMessages(transcript: string): Array<{
    timestamp: string;
    actor: string;
    content: string;
    isImportant: boolean;
  }> {
    const lines = transcript.split('\n').filter(l => l.trim());
    const messages: any[] = [];

    // Parse de mensagens
    for (const line of lines) {
      const match = line.match(/\[(.+?)\] (.+?): (.+)/);
      if (match) {
        const [, timestamp, actor, content] = match;
        const isImportant = this.isImportantMessage(content, line);

        messages.push({
          timestamp,
          actor,
          content,
          isImportant
        });
      }
    }

    // ✅ Priorizar mensagens importantes
    const importantMessages = messages.filter(m => m.isImportant);
    const clientMessages = messages.filter(m => m.actor === 'Cliente' && !m.isImportant);
    const agentMessages = messages.filter(m => m.actor.includes('Agente') && !m.isImportant);

    // ✅ Estratégia de compressão:
    // 1. Todas as mensagens importantes
    // 2. Primeira e última mensagem sempre
    // 3. Amostra de mensagens do cliente (mais importante)
    // 4. Amostra de mensagens do agente

    const compressed = [
      messages[0], // Primeira mensagem
      ...importantMessages,
      ...this.sampleMessages(clientMessages, 0.7), // 70% das mensagens do cliente
      ...this.sampleMessages(agentMessages, 0.4),  // 40% das mensagens do agente
      messages[messages.length - 1] // Última mensagem
    ];

    // Remover duplicatas e ordenar por timestamp
    const unique = Array.from(new Set(compressed.map(m => JSON.stringify(m))))
      .map(s => JSON.parse(s))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return unique;
  }

  /**
   * ✅ NOVO - Identificar mensagens importantes
   */
  private isImportantMessage(content: string, fullLine: string): boolean {
    const lowerContent = content.toLowerCase();
    const lowerLine = fullLine.toLowerCase();

    // ✅ Palavras-chave de problema
    const problemKeywords = [
      'problema', 'erro', 'bug', 'não funciona', 'quebrado',
      'falha', 'defeito', 'travado', 'lento', 'parou',
      'urgente', 'crítico', 'importante', 'emergência'
    ];

    // ✅ Palavras-chave de emoção
    const emotionKeywords = [
      'insatisfeito', 'frustrado', 'irritado', 'chateado',
      'cancelar', 'reembolso', 'reclamar', 'péssimo',
      'horrível', 'decepcionado'
    ];

    // ✅ Nota importante (emoji 🔔)
    if (lowerLine.includes('🔔') || lowerLine.includes('nota privada')) {
      return true;
    }

    // ✅ Contém palavra-chave de problema
    if (problemKeywords.some(k => lowerContent.includes(k))) {
      return true;
    }

    // ✅ Contém palavra-chave de emoção
    if (emotionKeywords.some(k => lowerContent.includes(k))) {
      return true;
    }

    // ✅ Mensagem longa (geralmente tem mais contexto)
    if (content.length > 200) {
      return true;
    }

    return false;
  }

  /**
   * Amostrar mensagens (pegar % representativa)
   */
  private sampleMessages(messages: any[], percentage: number): any[] {
    if (messages.length === 0) return [];

    const count = Math.max(1, Math.ceil(messages.length * percentage));
    const step = Math.floor(messages.length / count);

    const sampled: any[] = [];
    for (let i = 0; i < messages.length; i += step) {
      sampled.push(messages[i]);
      if (sampled.length >= count) break;
    }

    return sampled;
  }

  /**
   * Construir transcrição comprimida
   */
  private buildCompressedTranscript(messages: any[]): string {
    let transcript = '=== CONVERSA (RESUMIDA) ===\n\n';

    transcript += `Total de mensagens na conversa completa: ${messages.length}\n`;
    transcript += `Mensagens relevantes selecionadas para análise:\n\n`;

    for (const msg of messages) {
      transcript += `[${msg.timestamp}] ${msg.actor}: ${msg.content}\n`;
    }

    return transcript;
  }

  /**
   * Método principal de geração
   */
  private async generateFromFullTranscript(
    transcript: string,
    media: ProcessedMedia[],
    prompt: string
  ): Promise<string> {
    const parts: any[] = [
      { text: prompt },
      { text: '\n\n### TRANSCRIÇÃO DA CONVERSA:\n\n' + transcript }
    ];

    // Adicionar mídias
    if (media.length > 0) {
      parts.push({ text: '\n\n### MÍDIAS ANEXADAS:\n' });

      for (const m of media) {
        parts.push({
          inlineData: {
            mimeType: m.mimeType,
            data: m.data
          }
        });
      }
    }

    const result = await this.model.generateContent(parts);
    return result.response.text();
  }

  estimateTokens(text: string, mediaCount: number = 0): number {
    const textTokens = Math.ceil(text.length / 4);
    const mediaTokens = mediaCount * 1000;
    return textTokens + mediaTokens;
  }

  parseStructuredAnalysis(rawResponse: string): StructuredAnalysisResult {
    const jsonPayload = this.extractJsonPayload(rawResponse);
    const parsed = JSON.parse(jsonPayload) as Record<string, any>;

    const timeline = parsed.linha_do_tempo ?? parsed.linhaDoTempo ?? {};
    const handoffs = parsed.participacao_handoffs ?? parsed.participacaoHandoffs ?? {};
    const problem = parsed.problema_principal ?? parsed.problemaPrincipal ?? {};
    const conduct = parsed.conducao_atendimento ?? parsed.conducaoAtendimento ?? {};
    const riscos = parsed.risco_operacional ?? parsed.riscoOperacional ?? {};
    const acoesRaw = parsed.acoes_recomendadas ?? parsed.acoesRecomendadas ?? [];
    const evidenciasRaw = parsed.evidencias_chave ?? parsed.evidenciasChave ?? [];

    const parsedAcoes = Array.isArray(acoesRaw)
      ? acoesRaw
        .map((item) => this.parseAction(item))
        .filter((acao) => acao.oQueFazer !== 'Dados insuficientes')
        .slice(0, 6)
      : [];

    const fallbackAcoes: StructuredAnalysisAction[] =
      parsedAcoes.length > 0
        ? parsedAcoes
        : [
          {
            oQueFazer: 'Dados insuficientes',
            dono: 'Dados insuficientes',
            prazo: 'CURTO',
            impactoEsperado: 'Dados insuficientes'
          }
        ];

    const evidencias = Array.isArray(evidenciasRaw)
      ? evidenciasRaw.map((e) => this.asString(e)).filter((e) => e !== 'Dados insuficientes')
      : [];

    const riscoRecontato = this.parseRiskEntry(riscos.recontato, riscos.recontato_justificativa);
    const riscoInsatisfacao = this.parseRiskEntry(
      riscos.insatisfacao ?? riscos.insatisfacao_latente,
      riscos.insatisfacao_justificativa ?? riscos.insatisfacao_latente_justificativa
    );
    const riscoChurn = this.parseRiskEntry(riscos.churn, riscos.churn_justificativa);
    const criticidadeGeral = this.normalizeRiskLevel(
      riscos.criticidade_geral ?? riscos.criticidadeGeral ?? riscoRecontato.nivel
    );

    return {
      resumoExecutivo: this.asString(parsed.resumo_executivo ?? parsed.resumoExecutivo),
      linhaDoTempo: timeline,
      participacaoHandoffs: handoffs,
      problemaPrincipal: problem,
      conducaoAtendimento: conduct,
      riscoOperacional: {
        recontato: riscoRecontato,
        insatisfacao: riscoInsatisfacao,
        churn: riscoChurn,
        criticidadeGeral,
        justificativaGeral: this.asString(
          riscos.justificativa_geral ?? riscos.justificativaGeral,
          'Dados insuficientes'
        )
      },
      acoesRecomendadas: fallbackAcoes,
      evidenciasChave: evidencias
    };
  }

  parseHistoryAnalysis(rawResponse: string): any {
    const jsonPayload = this.extractJsonPayload(rawResponse);
    const parsed = JSON.parse(jsonPayload) as Record<string, any>;

    return {
      resumoExecutivo: this.asString(parsed.resumo_executivo || parsed.resumoExecutivo),
      perfilCliente: parsed.perfil_cliente || parsed.perfil_do_cliente || {},
      temasRecorrentes: parsed.temas_recorrentes || parsed.problemas_recorrentes || [],
      conducaoGeral: parsed.analise_conducao_geral || {},
      saudeConta: parsed.saude_da_conta || parsed.risco_de_churn_historico || {},
      planoRetencao: parsed.plano_de_retencao || parsed.recomendacoes_estrategicas || [],
      linhaTempo: parsed.linha_tempo_eventos || parsed.linha_do_tempo_eventos_chave || []
    };
  }

  formatStructuredAnalysisMarkdown(data: StructuredAnalysisResult): string {
    const risco = data.riscoOperacional;

    const actionLines = data.acoesRecomendadas
      .slice(0, 3)
      .map(
        (acao, index) =>
          `${index + 1}. O que fazer: ${acao.oQueFazer}\n   Dono: ${acao.dono}\n   Prazo: ${acao.prazo}\n   Impacto esperado: ${acao.impactoEsperado}`
      )
      .join('\n');

    return [
      '### Resumo Executivo',
      data.resumoExecutivo,
      '',
      '### Linha do Tempo',
      `- Início do atendimento: ${data.linhaDoTempo.inicio_atendimento || data.linhaDoTempo.inicioAtendimento || 'N/A'}`,
      `- Primeiro sinal de urgência: ${data.linhaDoTempo.primeiro_sinal_urgencia || data.linhaDoTempo.primeiroSinalUrgencia || 'N/A'}`,
      `- Status final: ${data.linhaDoTempo.status_final || data.linhaDoTempo.statusFinal || 'N/A'}`,
      `- Tempo total: ${data.linhaDoTempo.tempo_total || data.linhaDoTempo.tempoTotal || 'N/A'}`,
      '',
      '### Problema Principal',
      `- Percepção do Cliente: ${data.problemaPrincipal.percepcao_cliente || 'N/A'}`,
      `- Fato Técnico: ${data.problemaPrincipal.fato_tecnico_confirmado || 'N/A'}`,
      `- Causa: ${data.problemaPrincipal.classificacao_causa || 'N/A'}`,
      '',
      '### Analise de Risco Operacional',
      `- Recontato: ${risco.recontato.nivel} - ${risco.recontato.justificativa}`,
      `- Insatisfacao: ${risco.insatisfacao.nivel} - ${risco.insatisfacao.justificativa}`,
      `- Churn: ${risco.churn.nivel} - ${risco.churn.justificativa}`,
      `- Criticidade geral: ${risco.criticidadeGeral}`,
      `- Justificativa geral: ${risco.justificativaGeral}`,
      '',
      '### Acoes Recomendadas',
      actionLines
    ].join('\n');
  }

  createAnalysisPrompt(): string {
    return `
Você é um Analista Sênior de Qualidade em Suporte Técnico (CX/CS), com foco em diagnóstico do caso, evidências objetivas, redução de recontato e prevenção de churn.

ESCOPO E PRIORIDADE

Analise exclusivamente a transcrição e os anexos recebidos.
Se a informação não existir nos dados, escreva exatamente: "Não identificado na transcrição/anexos".
Não presuma erro. Pode haver "Condução adequada" e "Caso resolvido por orientação".

Distribuição de foco:

55% Caso do cliente (problema, fato técnico, causa, desfecho)
25% Risco e impacto (recontato, insatisfação, churn)
20% Avaliação do agente (condução e qualidade operacional)

REGRAS DE CAUSA RAIZ (OBRIGATÓRIO)

Marque "Bug/Falha do sistema" somente se houver evidência objetiva.
Se decorrer de pré-requisito, configuração ou uso incorreto, classifique adequadamente.
Se não der para confirmar, classifique "Indeterminado" e explique o que faltou.

CRITÉRIO MÍNIMO PARA MARCAR BUG
Confirmação explícita do agente de falha do produto

EVIDÊNCIAS (OBRIGATÓRIO)

Descreva o que a evidência mostra e o que comprova, não apenas o conteúdo do anexo.
Traga de 2 a 5 evidências-chave com trecho literal.
Sempre que possível, cite autor e horário.
Não invente SLA, política interna, causa ou solução que não esteja nos dados.

RESPOSTA (OBRIGATÓRIO)

Responda APENAS com JSON válido.
Sem markdown, sem comentário, sem texto fora do JSON.
Use níveis de risco somente: LOW, MEDIUM, HIGH, CRITICAL.

ESTRUTURA JSON OBRIGATÓRIA:
{
"resumo_executivo": "máximo 4 linhas com: problema + fato técnico + desfecho + risco",
"linha_do_tempo": {
"inicio_atendimento": "DD/MM/YYYY, HH:MM",
"primeiro_sinal_urgencia": "Descrição + DD/MM/YYYY, HH:MM + evidência literal",
"tempo_ate_reconhecimento": "X minutos/horas + O que foi dito pelo agente + evidência literal",
"tempo_ate_escalonamento": "X minutos/horas + Para quem foi escalado ou Não escalado",
"passou_por_n2": "SIM ou NÃO",
"status_final": "Resolvido | Parcialmente resolvido | Escalado | Aguardando cliente",
"tempo_total": "X dias, Z minutos"
},
"participacao_handoffs": {
"total_agentes": 0,
"agentes": ["Nome - papel - período"],
"handoffs_realizados": ["Agente A -> Agente B em DD/MM HH:MM - Contexto: SIM/PARCIAL/NÃO"],
"cliente_repetiu_informacoes": "SIM ou NÃO + Quais informações + evidência literal",
"evidencia_repeticao": "Trecho + data/hora ou Não identificado na transcrição/anexos"
},
"problema_principal": {
"percepcao_cliente": "o que o cliente acredita que ocorreu",
"fato_tecnico_confirmado": "o que é confirmado pelos dados",
"conclusao": "síntese da diferença entre percepção e fato técnico",
"problema_principal": "descrição objetiva do problema",
"contexto_relevante": "recorrência, tentativas anteriores, impacto",
"status_resolucao": "Resolvido na raiz | Workaround aplicado | Não resolvido | Escalado",
"classificacao_causa": "Bug/Falha do sistema | Uso incorreto do cliente / Pré-requisito não atendido | Configuração incorreta | Limitação de produto | Indeterminado",
"justificativa_causa": "justificativa com evidência objetiva"
},
"conducao_atendimento": {
"conducao_adequada": "SIM ou NÃO",
"postura_agente_principal": "Investigativa | Reativa | Proativa",
"gestao_expectativa": [
"Definiu prazos claros? SIM/NÃO",
"Comunicou status intermediários? SIM/NÃO",
"Explicou próximos passos? SIM/NÃO"
],
"clareza_comunicacao": "Clara e objetiva | Confusa | Jargão excessivo",
"senso_urgencia_demonstrado": "Agiu proporcionalmente | Reconheceu mas não priorizou | Não demonstrou",
"evidencias_conducao": ["Trecho [Autor, DD/MM HH:MM]"]
},
"risco_operacional": {
"recontato": { "nivel": "LOW|MEDIUM|HIGH|CRITICAL", "justificativa": "com evidência" },
"insatisfacao": { "nivel": "LOW|MEDIUM|HIGH|CRITICAL", "justificativa": "com evidência" },
"churn": { "nivel": "LOW|MEDIUM|HIGH|CRITICAL", "justificativa": "com evidência" },
"criticidade_geral": "LOW|MEDIUM|HIGH|CRITICAL",
"justificativa_geral": "1-2 linhas com base em evidência"
},
"acoes_recomendadas": [
{
"categoria": "Para o agente | Para processo | Para produto (se aplicável)",
"o_que_fazer": "ação específica e observável",
"exemplo_pratico": "como executar",
"dono": "Agente | Liderança | Operações | Treinamento | Produto",
"prazo": "IMEDIATO | CURTO | MÉDIO",
"impacto_esperado": "resultado mensurável esperado"
}
],
"evidencias_chave": [
"Trecho literal [Autor, DD/MM/YYYY HH:MM]",
"Trecho literal [Autor, DD/MM/YYYY HH:MM]"
],
"anexos_analisados": [
"Anexo X: o que mostra + o que comprova"
],
"notas_privadas_acoes_criticas": [
"Ação -> Dono sugerido -> Urgência (Hoje | 48h | 7d)"
]
}

REGRAS FINAIS

Se não houver ação crítica: "Nenhuma ação crítica registrada".
Caso tenha sido direcionado um atendimento, mas esteja como "CONT", não considere como handoff para fins de análise, a menos que haja evidência clara de que o cliente foi instruído a contatar outro agente ou canal.
Máximo de 6 ações recomendadas.
Seja rigoroso com evidência e conservador em inferências.
`;
  }

  createHistoryAnalysisPrompt(): string {
    return `
Você é um Estrategista de Sucesso do Cliente (Customer Success) e Analista de CX.
Sua tarefa é analisar um LOTE de conversas de um mesmo cliente para extrair uma visão macro do relacionamento.

Diferente de uma auditoria individual, seu foco está em padrões, evolução e saúde da conta a longo prazo.

### DISTRIBUIÇÃO DE FOCO
40% Perfil e Comportamento (quem é este cliente e como ele interage?)
30% Temas Recorrentes (o que faz ele voltar repetidamente?)
20% Evolução do Sentimento e Saúde da Conta (o relacionamento está melhorando ou piorando?)
10% Recomendações Estratégicas (como evitar o churn e resolver os problemas na raiz?)

### ESTRUTURA DA RESPOSTA (JSON OBRIGATÓRIO)
{
  "resumo_executivo": "Visão geral da jornada histórica do cliente (máx 5 linhas).",
  "perfil_cliente": {
    "comportamento_predominante": "Analítico, Impaciente, Colaborativo, etc. Justifique com o histórico.",
    "evolucao_sentimento": "Como o humor mudou da primeira para a última conversa (Melhorou | Piorou | Estável + Por que?).",
    "nivel_de_conhecimento": "Leigo | Intermediário | Avançado (sobre o produto)"
  },
  "temas_recorrentes": [
    {
      "tema": "Título do problema recorrente",
      "frequencia": "Baixa | Média | Alta (focado em quantas conversas apareceu)",
      "descricao": "Resumo do que se repete e por que não foi resolvido definitivamente ainda.",
      "impacto": "Impacto no sucesso do cliente"
    }
  ],
  "analise_conducao_geral": {
    "pontos_fortes_atendimento": ["O que os agentes costumam acertar com este cliente"],
    "falhas_sistemicas_ou_atrito": ["Padrões de erro ou atritos recorrentes no atendimento deste cliente"],
    "necessidade_de_especialista": "O cliente demanda um nível técnico que o N1 atual não supre? SIM/NÃO + Por que?"
  },
  "saude_da_conta": {
    "risco_churn": "LOW | MEDIUM | HIGH | CRITICAL",
    "fidelidade_percebida": "Fiel | Neutro | Em risco",
    "justificativa_saude": "Análise baseada na frequência de problemas vs satisfação com as soluções"
  },
  "plano_de_retencao": [
    {
      "acao": "O que fazer para garantir que o cliente fique e tenha sucesso",
      "dono": "Sucesso do Cliente | Produto | Suporte | Vendas",
      "prioridade": "ALTA | MEDIA | BAIXA"
    }
  ],
  "linha_tempo_eventos": [
    {
      "periodo": "MM/YYYY ou ID Conversa",
      "evento": "Fato marcante (Ex: Primeira reclamação de bug, Upgrade, Ameaça de cancelamento)",
      "resultado": "Como o suporte reagiu e o impacto disso"
    }
  ]
}

### REGRAS FINAIS
- Responda APENAS com JSON válido.
- Se houver dados insuficientes, use "Dados insuficientes".
- Seja crítico e aja como um parceiro estratégico da empresa.
`;
  }

  private parseScoreEntry(
    source: Record<string, any>,
    snakeKey: string,
    camelKey: string
  ): { nota: number; evidencia: string } {
    const raw = source[snakeKey] ?? source[camelKey];

    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return {
        nota: this.clampScore((raw as Record<string, any>).nota),
        evidencia: this.asString((raw as Record<string, any>).evidencia)
      };
    }

    return {
      nota: this.clampScore(raw),
      evidencia: 'Dados insuficientes'
    };
  }

  private parseAction(raw: unknown): StructuredAnalysisAction {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return {
        oQueFazer: this.asString(raw),
        dono: 'Dados insuficientes',
        prazo: 'CURTO',
        impactoEsperado: 'Dados insuficientes'
      };
    }

    const obj = raw as Record<string, unknown>;
    const prazoValue = this.asString(obj.prazo, 'CURTO');

    return {
      oQueFazer: this.asString(obj.o_que_fazer ?? obj.oQueFazer),
      dono: this.asString(obj.dono),
      prazo: this.normalizePrazo(prazoValue),
      impactoEsperado: this.asString(obj.impacto_esperado ?? obj.impactoEsperado)
    };
  }

  private parseRiskEntry(
    raw: unknown,
    fallbackJustification: unknown
  ): { nivel: StructuredRiskLevel; justificativa: string } {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const obj = raw as Record<string, unknown>;
      return {
        nivel: this.normalizeRiskLevel(obj.nivel),
        justificativa: this.asString(obj.justificativa, this.asString(fallbackJustification))
      };
    }

    return {
      nivel: this.normalizeRiskLevel(raw),
      justificativa: this.asString(fallbackJustification)
    };
  }

  private extractJsonPayload(rawResponse: string): string {
    const fencedMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
      return fencedMatch[1].trim();
    }

    const start = rawResponse.indexOf('{');
    const end = rawResponse.lastIndexOf('}');

    if (start >= 0 && end > start) {
      return rawResponse.slice(start, end + 1);
    }

    throw new Error('Resposta da IA nao contem JSON valido');
  }

  private normalizeRiskLevel(value: unknown): StructuredRiskLevel {
    const normalized = this.normalizeText(String(value ?? ''));

    if (normalized.includes('CRITICAL') || normalized.includes('CRITICO')) return 'CRITICAL';
    if (normalized.includes('HIGH') || normalized.includes('ALTO')) return 'HIGH';
    if (normalized.includes('MEDIUM') || normalized.includes('MEDIO')) return 'MEDIUM';
    if (normalized.includes('LOW') || normalized.includes('BAIXO')) return 'LOW';

    return 'LOW';
  }

  private normalizePrazo(value: string): string {
    const normalized = this.normalizeText(value);
    if (normalized.includes('IMEDIAT')) return 'IMEDIATO';
    if (normalized.includes('MEDIO')) return 'MEDIO';
    return 'CURTO';
  }

  private clampScore(value: unknown): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(2, Math.round(numeric)));
  }

  private clampScoreTotal(value: unknown, fallback: number): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return Math.max(0, Math.min(12, fallback));
    return Math.max(0, Math.min(12, Math.round(numeric)));
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();
  }

  private asString(value: unknown, fallback: string = 'Dados insuficientes'): string {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return fallback;
  }
}
