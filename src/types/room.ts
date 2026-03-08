import type { MessageType } from './message';

export type RoomType = 'direct' | 'group';

export type MemberRole = 'admin' | 'member';

export interface LastMessage {
  text: string;
  senderId: string;
  sentAt: Date;
  type: MessageType;
}

export interface ChatRoom {
  id: string;
  type: RoomType;
  name?: string;
  description?: string;
  imageUrl?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  memberIds: string[];
  lastMessage?: LastMessage;
  /** Custom metadata for app-specific room data */
  metadata?: Record<string, unknown>;
}

export interface RoomMember {
  userId: string;
  role: MemberRole;
  joinedAt: Date;
  lastReadAt: Date;
}

export interface CreateRoomParams {
  type: RoomType;
  name?: string;
  description?: string;
  imageUrl?: string;
  memberIds: string[];
  metadata?: Record<string, unknown>;
}
