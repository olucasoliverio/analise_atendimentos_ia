export interface CreateAnalysisDTO {
  conversationIds: string[];
}

export interface AnalysisResultDTO {
  id: string;
  conversationId: string;
  executiveSummary: string;
  mainProblem: string;
  context: string;
  resolutionStatus: string;
  causeCategory: 'REAL_BUG' | 'INCORRECT_USE' | 'PRODUCT_LIMITATION' | 'CONFIGURATION_ERROR' | 'INDETERMINATE';
  causeJustification: string;
  agentEvaluation: {
    technicalClarity: number;
    serviceConducting: number;
    empathy: number;
    objectivity: number;
    ownership: number;
    preventionRecontact: number;
    total: number;
    percentage: number;
  };
  risks: {
    overall: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    recontact: 'LOW' | 'MEDIUM' | 'HIGH';
    dissatisfaction: 'LOW' | 'MEDIUM' | 'HIGH';
    churn: 'LOW' | 'MEDIUM' | 'HIGH';
    justification: string;
  };
  keyEvidences: string[];
  recommendedActions: string[];
  criticalActions: string[];
  mediaProcessed: number;
  tokensUsed: number;
  processingTimeMs: number;
  createdAt: string;
}