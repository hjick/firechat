import {
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type FirestoreDataConverter,
} from 'firebase/firestore';
import type { ChatRoom, LastMessage, RoomMember } from '../types/room';
import type { Message } from '../types/message';

function toDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  return new Date();
}

function toTimestamp(value: Date | Timestamp): Timestamp {
  if (value instanceof Timestamp) return value;
  return Timestamp.fromDate(value);
}

export const roomConverter: FirestoreDataConverter<ChatRoom> = {
  toFirestore(room: ChatRoom): DocumentData {
    return {
      type: room.type,
      name: room.name ?? null,
      description: room.description ?? null,
      imageUrl: room.imageUrl ?? null,
      createdBy: room.createdBy,
      createdAt: toTimestamp(room.createdAt),
      updatedAt: toTimestamp(room.updatedAt),
      memberIds: room.memberIds,
      lastMessage: room.lastMessage
        ? {
            text: room.lastMessage.text,
            senderId: room.lastMessage.senderId,
            sentAt: toTimestamp(room.lastMessage.sentAt),
            type: room.lastMessage.type,
          }
        : null,
      metadata: room.metadata ?? null,
    };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): ChatRoom {
    const data = snapshot.data(options);
    const lastMessage: LastMessage | undefined = data.lastMessage
      ? {
          text: data.lastMessage.text,
          senderId: data.lastMessage.senderId,
          sentAt: toDate(data.lastMessage.sentAt),
          type: data.lastMessage.type,
        }
      : undefined;

    return {
      id: snapshot.id,
      type: data.type,
      name: data.name ?? undefined,
      description: data.description ?? undefined,
      imageUrl: data.imageUrl ?? undefined,
      createdBy: data.createdBy,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      memberIds: data.memberIds ?? [],
      lastMessage,
      metadata: data.metadata ?? undefined,
    };
  },
};

export const messageConverter: FirestoreDataConverter<Message> = {
  toFirestore(message: Message): DocumentData {
    return {
      senderId: message.senderId,
      type: message.type,
      text: message.text ?? null,
      mediaUrl: message.mediaUrl ?? null,
      fileName: message.fileName ?? null,
      fileSize: message.fileSize ?? null,
      mimeType: message.mimeType ?? null,
      status: message.status,
      createdAt: toTimestamp(message.createdAt),
      updatedAt: message.updatedAt ? toTimestamp(message.updatedAt) : null,
      deletedAt: message.deletedAt ? toTimestamp(message.deletedAt) : null,
      replyTo: message.replyTo ?? null,
      metadata: message.metadata ?? null,
    };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): Message {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      roomId: snapshot.ref.parent.parent?.id ?? '',
      senderId: data.senderId,
      type: data.type,
      text: data.text ?? undefined,
      mediaUrl: data.mediaUrl ?? undefined,
      fileName: data.fileName ?? undefined,
      fileSize: data.fileSize ?? undefined,
      mimeType: data.mimeType ?? undefined,
      status: data.status ?? 'sent',
      createdAt: toDate(data.createdAt),
      updatedAt: data.updatedAt ? toDate(data.updatedAt) : undefined,
      deletedAt: data.deletedAt ? toDate(data.deletedAt) : undefined,
      replyTo: data.replyTo ?? undefined,
      metadata: data.metadata ?? undefined,
    };
  },
};

export const memberConverter: FirestoreDataConverter<RoomMember> = {
  toFirestore(member: RoomMember): DocumentData {
    return {
      userId: member.userId,
      role: member.role,
      joinedAt: toTimestamp(member.joinedAt),
      lastReadAt: toTimestamp(member.lastReadAt),
    };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): RoomMember {
    const data = snapshot.data(options);
    return {
      userId: snapshot.id,
      role: data.role ?? 'member',
      joinedAt: toDate(data.joinedAt),
      lastReadAt: toDate(data.lastReadAt),
    };
  },
};
