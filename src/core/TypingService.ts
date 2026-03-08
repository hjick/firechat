import {
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  onSnapshot,
} from 'firebase/firestore';
import type { FireChat } from './FireChat';

export class TypingService {
  private typingTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(private readonly firechat: FireChat) {}

  private roomDoc(roomId: string) {
    return doc(this.firechat.firestore, this.firechat.roomsCollection, roomId);
  }

  /**
   * Signal that the current user started typing.
   * Automatically stops after the configured timeout.
   */
  async startTyping(roomId: string): Promise<void> {
    if (!this.firechat.options.enableTypingIndicator) return;

    const currentUser = this.firechat.getCurrentUser();

    await updateDoc(this.roomDoc(roomId), {
      typingUserIds: arrayUnion(currentUser.id),
    });

    // Clear existing timer for this room
    const existingTimer = this.typingTimers.get(roomId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Auto-stop typing after timeout
    const timer = setTimeout(() => {
      this.stopTyping(roomId);
      this.typingTimers.delete(roomId);
    }, this.firechat.options.typingTimeout);

    this.typingTimers.set(roomId, timer);
  }

  /**
   * Signal that the current user stopped typing.
   */
  async stopTyping(roomId: string): Promise<void> {
    if (!this.firechat.options.enableTypingIndicator) return;

    const currentUser = this.firechat.getCurrentUser();

    const timer = this.typingTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.typingTimers.delete(roomId);
    }

    await updateDoc(this.roomDoc(roomId), {
      typingUserIds: arrayRemove(currentUser.id),
    });
  }

  /**
   * Subscribe to typing indicator changes in a room.
   * Returns user IDs of users currently typing (excluding current user).
   */
  subscribe(
    roomId: string,
    callback: (typingUserIds: string[]) => void,
  ): () => void {
    if (!this.firechat.options.enableTypingIndicator) {
      callback([]);
      return () => {};
    }

    const currentUser = this.firechat.getCurrentUser();

    return onSnapshot(this.roomDoc(roomId), (snapshot) => {
      const data = snapshot.data();
      const typingUserIds: string[] = data?.typingUserIds ?? [];

      // Exclude current user
      callback(typingUserIds.filter((id) => id !== currentUser.id));
    });
  }
}
