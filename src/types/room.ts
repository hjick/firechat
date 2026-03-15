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
  /** Whether this room is publicly discoverable by non-members. Default: false */
  isPublic?: boolean;
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
  /** Set to true to make this room publicly discoverable. Default: false */
  isPublic?: boolean;
  metadata?: Record<string, unknown>;
}

/** Options for listing public rooms */
export interface PublicRoomListOptions {
  /** Maximum number of rooms to fetch. Default: 20 */
  limit?: number;
  /** Cursor for pagination: fetch rooms updated before this date */
  startAfter?: Date;
}
