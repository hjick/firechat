export type MessageType = 'text' | 'image' | 'file' | 'system';

export type DeliveryStatus = 'sending' | 'sent' | 'failed';

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  type: MessageType;
  text?: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  status: DeliveryStatus;
  createdAt: Date;
  updatedAt?: Date;
  deletedAt?: Date;
  /** Message ID this message is replying to */
  replyTo?: string;
  /** Custom metadata for app-specific message data */
  metadata?: Record<string, unknown>;
}

export interface SendMessageParams {
  type: MessageType;
  text?: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  replyTo?: string;
  metadata?: Record<string, unknown>;
}

export interface MessagePage {
  messages: Message[];
  hasMore: boolean;
}
