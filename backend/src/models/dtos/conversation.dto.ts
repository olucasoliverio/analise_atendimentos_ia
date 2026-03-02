export interface ConversationDetailDTO {
  id: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  createdAt: string;
  updatedAt: string;
  status?: string;
  assignedAgentId?: string;
  assignedAgentName?: string;
  messages: MessageDTO[];
}

export interface MessageDTO {
  id: string;
  messageType: 'NORMAL' | 'PRIVATE' | 'SYSTEM';
  actorType: 'USER' | 'AGENT' | 'SYSTEM' | 'BOT';
  actorId?: string;  // ← ADICIONAR esta linha
  actorName?: string;
  content: string;
  createdAt: string;
  hasMedia: boolean;
  mediaUrls: string[];
  isImportantNote: boolean;
}


export interface MediaDTO {
  type: 'IMAGE' | 'AUDIO' | 'VIDEO' | 'FILE';
  url: string;
  contentType?: string;
  fileName?: string;
}