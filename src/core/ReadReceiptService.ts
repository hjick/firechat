import {
  doc,
  updateDoc,
  getDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  getCountFromServer,
  Timestamp,
} from 'firebase/firestore';
import type { FireChat } from './FireChat';
import type { RoomMember } from '../types/room';
import { memberConverter } from '../utils/converter';

export class ReadReceiptService {
  constructor(private readonly firechat: FireChat) {}

  private memberDoc(roomId: string, userId: string) {
    return doc(
      this.firechat.firestore,
      this.firechat.roomsCollection,
      roomId,
      'members',
      userId,
    );
  }

  private messagesRef(roomId: string) {
    return collection(
      this.firechat.firestore,
      this.firechat.roomsCollection,
      roomId,
      'messages',
    );
  }

  /**
   * Mark all messages in a room as read up to now.
   */
  async markAsRead(roomId: string): Promise<void> {
    if (!this.firechat.options.enableReadReceipts) return;

    const currentUser = this.firechat.getCurrentUser();
    const memberRef = this.memberDoc(roomId, currentUser.id);

    await updateDoc(memberRef, {
      lastReadAt: Timestamp.now(),
    });
  }

  /**
   * Get the unread message count for the current user in a room.
   */
  async getUnreadCount(roomId: string): Promise<number> {
    if (!this.firechat.options.enableReadReceipts) return 0;

    const currentUser = this.firechat.getCurrentUser();
    const memberRef = this.memberDoc(roomId, currentUser.id).withConverter(memberConverter);

    const memberSnap = await getDoc(memberRef);
    if (!memberSnap.exists()) return 0;

    const member = memberSnap.data();

    // Count messages created after lastReadAt
    const q = query(
      this.messagesRef(roomId),
      where('createdAt', '>', Timestamp.fromDate(member.lastReadAt)),
    );

    const countSnap = await getCountFromServer(q);
    return countSnap.data().count;
  }

  /**
   * Subscribe to unread count changes for the current user in a room.
   * Returns an unsubscribe function.
   */
  subscribeToUnreadCount(
    roomId: string,
    callback: (count: number) => void,
  ): () => void {
    if (!this.firechat.options.enableReadReceipts) {
      callback(0);
      return () => {};
    }

    const currentUser = this.firechat.getCurrentUser();
    const memberRef = this.memberDoc(roomId, currentUser.id).withConverter(memberConverter);

    // Watch member doc for lastReadAt changes, then recount
    return onSnapshot(memberRef, async (snapshot) => {
      if (!snapshot.exists()) {
        callback(0);
        return;
      }

      const member = snapshot.data();
      const q = query(
        this.messagesRef(roomId),
        where('createdAt', '>', Timestamp.fromDate(member.lastReadAt)),
      );

      const countSnap = await getCountFromServer(q);
      callback(countSnap.data().count);
    });
  }

  /**
   * Get read receipt info for all members in a room.
   */
  async getRoomMembers(roomId: string): Promise<RoomMember[]> {
    const { getDocs } = await import('firebase/firestore');
    const membersRef = collection(
      this.firechat.firestore,
      this.firechat.roomsCollection,
      roomId,
      'members',
    ).withConverter(memberConverter);

    const snapshot = await getDocs(membersRef);
    return snapshot.docs.map((doc) => doc.data());
  }
}
