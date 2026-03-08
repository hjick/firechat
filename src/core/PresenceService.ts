import {
  ref,
  set,
  onValue,
  onDisconnect,
  serverTimestamp as rtdbServerTimestamp,
  type Database,
} from 'firebase/database';
import type { FireChat } from './FireChat';

interface PresenceData {
  isOnline: boolean;
  lastSeenAt: number | object; // number when reading, serverTimestamp object when writing
}

export class PresenceService {
  private unsubscribers: Map<string, () => void> = new Map();
  private myPresenceCleanup: (() => void) | null = null;

  constructor(private readonly firechat: FireChat) {
    if (this.firechat.options.enablePresence && this.firechat.database) {
      this.setupMyPresence();
    }
  }

  private get db(): Database | null {
    return this.firechat.database;
  }

  private presenceRef(userId: string) {
    if (!this.db) throw new Error('Presence requires Firebase RTDB. Enable it in options.');
    const prefix = this.firechat.options.collectionPrefix;
    return ref(this.db, `${prefix}_presence/${userId}`);
  }

  /**
   * Set up presence tracking for the current user.
   * Automatically marks as offline on disconnect.
   */
  private setupMyPresence(): void {
    if (!this.db) return;

    try {
      const currentUser = this.firechat.getCurrentUser();
      const myRef = this.presenceRef(currentUser.id);

      // Set online
      set(myRef, {
        isOnline: true,
        lastSeenAt: rtdbServerTimestamp(),
      });

      // Set offline on disconnect
      onDisconnect(myRef).set({
        isOnline: false,
        lastSeenAt: rtdbServerTimestamp(),
      });

      this.myPresenceCleanup = () => {
        set(myRef, {
          isOnline: false,
          lastSeenAt: rtdbServerTimestamp(),
        });
      };
    } catch {
      // Auth might not be ready yet, will be set up later
    }
  }

  /**
   * Initialize presence after auth is ready.
   */
  async init(): Promise<void> {
    if (this.firechat.options.enablePresence && this.db) {
      this.setupMyPresence();
    }
  }

  /**
   * Subscribe to a user's online/offline status.
   * Returns an unsubscribe function.
   */
  subscribe(
    userId: string,
    callback: (data: { isOnline: boolean; lastSeenAt: Date | null }) => void,
  ): () => void {
    if (!this.firechat.options.enablePresence || !this.db) {
      callback({ isOnline: false, lastSeenAt: null });
      return () => {};
    }

    const userRef = this.presenceRef(userId);

    const unsubscribe = onValue(userRef, (snapshot) => {
      const data = snapshot.val() as PresenceData | null;
      callback({
        isOnline: data?.isOnline ?? false,
        lastSeenAt:
          typeof data?.lastSeenAt === 'number'
            ? new Date(data.lastSeenAt)
            : null,
      });
    });

    this.unsubscribers.set(userId, unsubscribe);
    return () => {
      unsubscribe();
      this.unsubscribers.delete(userId);
    };
  }

  /**
   * Clean up all presence subscriptions and mark current user as offline.
   */
  destroy(): void {
    this.myPresenceCleanup?.();
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers.clear();
  }
}
