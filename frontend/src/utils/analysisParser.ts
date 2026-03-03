export interface ParsedAnalysisText {
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
  _raw_text?: string;
  [key: string]: any;
}

const normalizeAnalysisKeys = (parsed: ParsedAnalysisText): ParsedAnalysisText => ({
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
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
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

const tryParseJson = (candidate: string): ParsedAnalysisText | null => {
  try {
    const parsed = JSON.parse(candidate);

    if (typeof parsed === 'string') {
      const nested = parsed.trim();
      if (nested.startsWith('{')) {
        const parsedNested = JSON.parse(nested) as ParsedAnalysisText;
        return parsedNested;
      }
      return { resumo_executivo: nested };
    }

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as ParsedAnalysisText;
    }
  } catch {
    return null;
  }

  return null;
};

export const parseAnalysisText = (text: string): ParsedAnalysisText => {
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
    resumo_executivo: 'Nao foi possivel estruturar automaticamente esta analise.',
    _raw_text: cleaned
  };
};
