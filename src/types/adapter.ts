import type { ChatRoom } from './room';
import type { Message } from './message';
import type { ChatUser } from './user';

/**
 * StorageAdapter interface for syncing chat data with external storage (e.g., MySQL, PostgreSQL).
 * Implement the methods you need — all are optional.
 * These hooks are called after successful Firestore operations.
 *
 * Example:
 * ```typescript
 * const myAdapter: StorageAdapter = {
 *   async onMessageSent(roomId, message) {
 *     await fetch('/api/chat/messages', {
 *       method: 'POST',
 *       body: JSON.stringify({ roomId, ...message }),
 *     });
 *   },
 * };
 * ```
 */
export interface StorageAdapter {
  onRoomCreated?(room: ChatRoom): Promise<void>;
  onRoomUpdated?(roomId: string, updates: Partial<ChatRoom>): Promise<void>;
  onRoomDeleted?(roomId: string): Promise<void>;
  onMessageSent?(roomId: string, message: Message): Promise<void>;
  onMessageUpdated?(roomId: string, message: Message): Promise<void>;
  onMessageDeleted?(roomId: string, messageId: string): Promise<void>;
  onMemberJoined?(roomId: string, user: ChatUser): Promise<void>;
  onMemberLeft?(roomId: string, userId: string): Promise<void>;
}
