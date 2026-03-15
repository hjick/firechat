import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  getDoc,
  getDocs,
  endBefore,
  limitToLast,
} from 'firebase/firestore';
import type { FireChat } from './FireChat';
import type { Message, SendMessageParams, MessagePage } from '../types/message';
import type { UploadProgress } from '../types/uploader';
import { messageConverter } from '../utils/converter';

export class MessageService {
  constructor(private readonly firechat: FireChat) {}

  private messagesRef(roomId: string) {
    return collection(
      this.firechat.firestore,
      this.firechat.roomsCollection,
      roomId,
      'messages',
    );
  }

  private roomDoc(roomId: string) {
    return doc(this.firechat.firestore, this.firechat.roomsCollection, roomId);
  }

  /**
   * Send a new message to a room.
   * Uses optimistic status: returns with 'sending', updates to 'sent' after write.
   */
  async send(roomId: string, params: SendMessageParams): Promise<Message> {
    const currentUser = this.firechat.getCurrentUser();
    const now = new Date();

    const message: Message = {
      id: '', // Will be set after Firestore write
      roomId,
      senderId: currentUser.id,
      type: params.type,
      text: params.text,
      mediaUrl: params.mediaUrl,
      thumbnailUrl: params.thumbnailUrl,
      fileName: params.fileName,
      fileSize: params.fileSize,
      mimeType: params.mimeType,
      status: 'sending',
      createdAt: now,
      replyTo: params.replyTo,
      metadata: params.metadata,
    };

    try {
      const docRef = await addDoc(
        this.messagesRef(roomId).withConverter(messageConverter),
        { ...message, status: 'sent' },
      );

      // Update room's lastMessage
      await updateDoc(this.roomDoc(roomId), {
        lastMessage: {
          text: params.text ?? `[${params.type}]`,
          senderId: currentUser.id,
          sentAt: Timestamp.fromDate(now),
          type: params.type,
        },
        updatedAt: serverTimestamp(),
      });

      const sentMessage = { ...message, id: docRef.id, status: 'sent' as const };

      // Call adapter hook
      await this.firechat.adapter?.onMessageSent?.(roomId, sentMessage);

      return sentMessage;
    } catch (error) {
      return { ...message, status: 'failed' as const };
    }
  }

  /**
   * Convenience method to send an image message.
   * If a FileUploader is configured and file is provided, uploads the file first.
   * Otherwise, requires mediaUrl to be provided.
   */
  async sendImage(
    roomId: string,
    params: {
      file?: File | { uri: string; name?: string; type?: string };
      mediaUrl?: string;
      thumbnailUrl?: string;
      fileName?: string;
      text?: string;
      metadata?: Record<string, unknown>;
      onProgress?: (progress: UploadProgress) => void;
    },
  ): Promise<Message> {
    let mediaUrl = params.mediaUrl;
    let fileName = params.fileName;
    let fileSize: number | undefined;
    let mimeType: string | undefined;

    if (params.file && this.firechat.uploader) {
      const path = `${this.firechat.options.collectionPrefix}/images/${roomId}/${Date.now()}_${fileName ?? 'image'}`;
      const result = await this.firechat.uploader.upload(
        params.file,
        path,
        params.onProgress,
      );
      mediaUrl = result.url;
      fileSize = result.size;
      mimeType = result.mimeType;
      fileName = fileName ?? path.split('/').pop();
    }

    if (!mediaUrl) {
      throw new Error(
        'Either provide mediaUrl or configure a FileUploader and pass file.',
      );
    }

    return this.send(roomId, {
      type: 'image',
      mediaUrl,
      thumbnailUrl: params.thumbnailUrl,
      fileName,
      fileSize,
      mimeType,
      text: params.text,
      metadata: params.metadata,
    });
  }

  /**
   * Convenience method to send a file message.
   * If a FileUploader is configured and file is provided, uploads the file first.
   * Otherwise, requires mediaUrl to be provided.
   */
  async sendFile(
    roomId: string,
    params: {
      file?: File | { uri: string; name?: string; type?: string };
      mediaUrl?: string;
      fileName?: string;
      text?: string;
      metadata?: Record<string, unknown>;
      onProgress?: (progress: UploadProgress) => void;
    },
  ): Promise<Message> {
    let mediaUrl = params.mediaUrl;
    let fileName = params.fileName;
    let fileSize: number | undefined;
    let mimeType: string | undefined;

    if (params.file && this.firechat.uploader) {
      const path = `${this.firechat.options.collectionPrefix}/files/${roomId}/${Date.now()}_${fileName ?? 'file'}`;
      const result = await this.firechat.uploader.upload(
        params.file,
        path,
        params.onProgress,
      );
      mediaUrl = result.url;
      fileSize = result.size;
      mimeType = result.mimeType;
      fileName = fileName ?? path.split('/').pop();
    }

    if (!mediaUrl) {
      throw new Error(
        'Either provide mediaUrl or configure a FileUploader and pass file.',
      );
    }

    return this.send(roomId, {
      type: 'file',
      mediaUrl,
      fileName,
      fileSize,
      mimeType,
      text: params.text,
      metadata: params.metadata,
    });
  }

  /**
   * Update a message's text (edit).
   */
  async update(
    roomId: string,
    messageId: string,
    updates: { text: string },
  ): Promise<void> {
    const msgDoc = doc(this.messagesRef(roomId), messageId);
    await updateDoc(msgDoc, {
      text: updates.text,
      updatedAt: serverTimestamp(),
    });

    // Fetch updated message for adapter
    if (this.firechat.adapter?.onMessageUpdated) {
      const snapshot = await getDoc(
        msgDoc.withConverter(messageConverter),
      );
      if (snapshot.exists()) {
        await this.firechat.adapter.onMessageUpdated(roomId, snapshot.data());
      }
    }
  }

  /**
   * Soft-delete a message (sets deletedAt, keeps document).
   */
  async delete(roomId: string, messageId: string): Promise<void> {
    await updateDoc(doc(this.messagesRef(roomId), messageId), {
      deletedAt: serverTimestamp(),
      text: null,
      mediaUrl: null,
    });

    await this.firechat.adapter?.onMessageDeleted?.(roomId, messageId);
  }

  /**
   * Fetch messages with cursor-based pagination.
   * Returns messages in reverse chronological order (newest first).
   */
  async fetch(
    roomId: string,
    options?: { limit?: number; before?: Date },
  ): Promise<MessagePage> {
    const pageSize = options?.limit ?? this.firechat.options.pageSize;

    // Fetch one extra to determine hasMore
    let q = query(
      this.messagesRef(roomId).withConverter(messageConverter),
      orderBy('createdAt', 'desc'),
      limit(pageSize + 1),
    );

    if (options?.before) {
      q = query(
        this.messagesRef(roomId).withConverter(messageConverter),
        orderBy('createdAt', 'desc'),
        startAfter(Timestamp.fromDate(options.before)),
        limit(pageSize + 1),
      );
    }

    const snapshot = await getDocs(q);
    const messages = snapshot.docs.map((doc) => doc.data());

    const hasMore = messages.length > pageSize;
    if (hasMore) {
      messages.pop(); // Remove the extra item
    }

    return { messages, hasMore };
  }

  /**
   * Subscribe to new messages in real-time.
   * Only receives messages created after the subscription starts.
   * Returns an unsubscribe function.
   */
  subscribe(
    roomId: string,
    callback: (messages: Message[]) => void,
  ): () => void {
    const q = query(
      this.messagesRef(roomId).withConverter(messageConverter),
      orderBy('createdAt', 'desc'),
      limit(1),
    );

    let isFirst = true;

    return onSnapshot(q, (snapshot) => {
      // Skip the initial snapshot (historical data)
      if (isFirst) {
        isFirst = false;
        return;
      }

      const newMessages: Message[] = [];
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          newMessages.push(change.doc.data());
        }
      });

      if (newMessages.length > 0) {
        callback(newMessages);
      }
    });
  }

  /**
   * Subscribe to all messages with real-time updates (for initial load + live updates).
   * Uses a sliding window approach with the specified page size.
   */
  subscribeToLatest(
    roomId: string,
    callback: (messages: Message[]) => void,
    pageSize?: number,
  ): () => void {
    const size = pageSize ?? this.firechat.options.pageSize;

    const q = query(
      this.messagesRef(roomId).withConverter(messageConverter),
      orderBy('createdAt', 'desc'),
      limit(size),
    );

    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map((doc) => doc.data());
      callback(messages);
    });
  }
}
