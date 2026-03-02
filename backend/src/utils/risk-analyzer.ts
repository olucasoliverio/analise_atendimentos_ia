export class RiskAnalyzer {
  private static negativeKeywords = [
    'insatisfeito', 'reclamar', 'cancelar', 'problema',
    'frustrado', 'não funciona', 'bug', 'erro',
    'péssimo', 'horrível', 'decepcionado', 'churn'
  ];

  /**
   * Analisa sinais de risco em mensagens
   */
  static analyzeRiskSignals(messages: any[]): number {
    let riskCount = 0;

    for (const msg of messages) {
      if (msg.actorType !== 'USER') continue;

      const content = msg.content.toLowerCase();
      
      for (const keyword of this.negativeKeywords) {
        if (content.includes(keyword)) {
          riskCount++;
        }
      }
    }

    return riskCount;
  }
}