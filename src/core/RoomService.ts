import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  Timestamp,
  setDoc,
  limit as firestoreLimit,
  startAfter as firestoreStartAfter,
} from 'firebase/firestore';
import type { FireChat } from './FireChat';
import type { ChatRoom, CreateRoomParams, RoomMember, PublicRoomListOptions } from '../types/room';
import { roomConverter, memberConverter } from '../utils/converter';

export class RoomService {
  constructor(private readonly firechat: FireChat) {}

  private get roomsRef() {
    return collection(this.firechat.firestore, this.firechat.roomsCollection);
  }

  private roomDoc(roomId: string) {
    return doc(this.firechat.firestore, this.firechat.roomsCollection, roomId);
  }

  private membersRef(roomId: string) {
    return collection(
      this.firechat.firestore,
      this.firechat.roomsCollection,
      roomId,
      'members',
    );
  }

  async create(params: CreateRoomParams): Promise<ChatRoom> {
    const currentUser = this.firechat.getCurrentUser();
    const now = new Date();

    if (params.type === 'direct' && params.isPublic) {
      throw new Error('Direct rooms cannot be public.');
    }

    // Ensure creator is in memberIds
    const memberIds = Array.from(
      new Set([currentUser.id, ...params.memberIds]),
    );

    const roomData: Omit<ChatRoom, 'id'> = {
      type: params.type,
      name: params.name,
      description: params.description,
      imageUrl: params.imageUrl,
      createdBy: currentUser.id,
      createdAt: now,
      updatedAt: now,
      memberIds,
      isPublic: params.isPublic ?? false,
      metadata: params.metadata,
    };

    const docRef = await addDoc(
      this.roomsRef.withConverter(roomConverter),
      { ...roomData, id: '' } as ChatRoom,
    );

    // Create member subcollection entries
    const memberPromises = memberIds.map((userId) =>
      setDoc(doc(this.membersRef(docRef.id), userId).withConverter(memberConverter), {
        userId,
        role: userId === currentUser.id ? 'admin' : 'member',
        joinedAt: now,
        lastReadAt: now,
      }),
    );
    await Promise.all(memberPromises);

    const room: ChatRoom = { ...roomData, id: docRef.id };

    // Call adapter hook
    await this.firechat.adapter?.onRoomCreated?.(room);

    return room;
  }

  async get(roomId: string): Promise<ChatRoom | null> {
    const snapshot = await getDoc(
      this.roomDoc(roomId).withConverter(roomConverter),
    );
    return snapshot.exists() ? snapshot.data() : null;
  }

  async update(
    roomId: string,
    updates: Partial<Pick<ChatRoom, 'name' | 'description' | 'imageUrl' | 'isPublic' | 'metadata'>>,
  ): Promise<void> {
    await updateDoc(this.roomDoc(roomId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    await this.firechat.adapter?.onRoomUpdated?.(roomId, updates);
  }

  async delete(roomId: string): Promise<void> {
    await deleteDoc(this.roomDoc(roomId));
    await this.firechat.adapter?.onRoomDeleted?.(roomId);
  }

  async addMembers(roomId: string, userIds: string[]): Promise<void> {
    const now = new Date();

    await updateDoc(this.roomDoc(roomId), {
      memberIds: arrayUnion(...userIds),
      updatedAt: serverTimestamp(),
    });

    const memberPromises = userIds.map((userId) =>
      setDoc(doc(this.membersRef(roomId), userId).withConverter(memberConverter), {
        userId,
        role: 'member' as const,
        joinedAt: now,
        lastReadAt: now,
      }),
    );
    await Promise.all(memberPromises);
  }

  async removeMembers(roomId: string, userIds: string[]): Promise<void> {
    await updateDoc(this.roomDoc(roomId), {
      memberIds: arrayRemove(...userIds),
      updatedAt: serverTimestamp(),
    });

    const deletePromises = userIds.map((userId) =>
      deleteDoc(doc(this.membersRef(roomId), userId)),
    );
    await Promise.all(deletePromises);
  }

  async leave(roomId: string): Promise<void> {
    const currentUser = this.firechat.getCurrentUser();
    await this.removeMembers(roomId, [currentUser.id]);
    await this.firechat.adapter?.onMemberLeft?.(roomId, currentUser.id);
  }

  async getMembers(roomId: string): Promise<RoomMember[]> {
    const snapshot = await getDocs(
      this.membersRef(roomId).withConverter(memberConverter),
    );
    return snapshot.docs.map((doc) => doc.data());
  }

  /**
   * Subscribe to real-time updates of rooms the current user belongs to.
   * Returns an unsubscribe function.
   */
  subscribe(callback: (rooms: ChatRoom[]) => void): () => void {
    const currentUser = this.firechat.getCurrentUser();

    const q = query(
      this.roomsRef.withConverter(roomConverter),
      where('memberIds', 'array-contains', currentUser.id),
      orderBy('updatedAt', 'desc'),
    );

    return onSnapshot(q, (snapshot) => {
      const rooms = snapshot.docs.map((doc) => doc.data());
      callback(rooms);
    });
  }

  /**
   * Fetch a paginated list of public rooms.
   * Does NOT require the current user to be a member.
   */
  async listPublic(options?: PublicRoomListOptions): Promise<ChatRoom[]> {
    const pageSize = options?.limit ?? 20;

    const constraints: Parameters<typeof query>[1][] = [
      where('isPublic', '==', true),
      orderBy('updatedAt', 'desc'),
      firestoreLimit(pageSize),
    ];

    if (options?.startAfter) {
      constraints.push(firestoreStartAfter(Timestamp.fromDate(options.startAfter)));
    }

    const q = query(
      this.roomsRef.withConverter(roomConverter),
      ...constraints,
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data());
  }

  /**
   * Subscribe to real-time updates of public rooms.
   * Returns an unsubscribe function.
   */
  subscribePublic(
    callback: (rooms: ChatRoom[]) => void,
    options?: { limit?: number },
  ): () => void {
    const pageSize = options?.limit ?? 20;

    const q = query(
      this.roomsRef.withConverter(roomConverter),
      where('isPublic', '==', true),
      orderBy('updatedAt', 'desc'),
      firestoreLimit(pageSize),
    );

    return onSnapshot(q, (snapshot) => {
      const rooms = snapshot.docs.map((doc) => doc.data());
      callback(rooms);
    });
  }

  /**
   * Join a public room. Throws if the room is not public or does not exist.
   */
  async join(roomId: string): Promise<ChatRoom> {
    const currentUser = this.firechat.getCurrentUser();
    const room = await this.get(roomId);

    if (!room) {
      throw new Error(`Room ${roomId} not found.`);
    }

    if (!room.isPublic) {
      throw new Error(`Room ${roomId} is not public. Cannot join without invitation.`);
    }

    if (room.memberIds.includes(currentUser.id)) {
      return room;
    }

    await this.addMembers(roomId, [currentUser.id]);
    await this.firechat.adapter?.onMemberJoined?.(roomId, currentUser);

    return { ...room, memberIds: [...room.memberIds, currentUser.id] };
  }

  /**
   * Find an existing direct chat room between current user and another user.
   */
  async findDirectRoom(otherUserId: string): Promise<ChatRoom | null> {
    const currentUser = this.firechat.getCurrentUser();

    const q = query(
      this.roomsRef.withConverter(roomConverter),
      where('type', '==', 'direct'),
      where('memberIds', 'array-contains', currentUser.id),
    );

    const snapshot = await getDocs(q);
    const room = snapshot.docs
      .map((doc) => doc.data())
      .find(
        (room) =>
          room.memberIds.length === 2 &&
          room.memberIds.includes(otherUserId),
      );

    return room ?? null;
  }

  /**
   * Get or create a direct chat room with another user.
   */
  async getOrCreateDirect(otherUserId: string): Promise<ChatRoom> {
    const existing = await this.findDirectRoom(otherUserId);
    if (existing) return existing;

    return this.create({
      type: 'direct',
      memberIds: [otherUserId],
    });
  }
}
