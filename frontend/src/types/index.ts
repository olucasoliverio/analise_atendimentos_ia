// src/types/index.ts

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'LEADERSHIP' | 'QUALITY' | 'ANALYST' | 'PRODUCT';
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  name: string;
  password: string;
}

// Conversation Types
export interface Conversation {
  id: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  createdAt: string;
  updatedAt: string;
  status?: string;
  assignedAgentId?: string;
  assignedAgentName?: string;
  messages: Message[];
}

export interface Message {
  id: string;
  messageType: 'NORMAL' | 'PRIVATE' | 'SYSTEM';
  actorType: 'USER' | 'AGENT' | 'SYSTEM' | 'BOT';
  actorId?: string;  // ← ADICIONAR
  actorName?: string;
  content: string;
  createdAt: string;
  hasMedia: boolean;
  mediaUrls: string[];
  isImportantNote: boolean;
}

// Analysis Types
export interface Analysis {
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

export interface CreateAnalysisRequest {
  conversationIds: string[];
}