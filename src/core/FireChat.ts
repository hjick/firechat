import { getFirestore, type Firestore } from 'firebase/firestore';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
  type Auth,
  type User as FirebaseUser,
} from 'firebase/auth';
import { getDatabase, type Database } from 'firebase/database';
import type { FireChatConfig, FireChatOptions } from '../types/config';
import { DEFAULT_OPTIONS } from '../types/config';
import type { ChatUser } from '../types/user';
import type { StorageAdapter } from '../types/adapter';
import type { FileUploader } from '../types/uploader';
import { RoomService } from './RoomService';
import { MessageService } from './MessageService';
import { TypingService } from './TypingService';
import { ReadReceiptService } from './ReadReceiptService';
import { PresenceService } from './PresenceService';
import { UserResolverService } from './UserResolverService';

export class FireChat {
  private static instance: FireChat | null = null;

  readonly firestore: Firestore;
  readonly auth: Auth;
  readonly database: Database | null;
  readonly config: FireChatConfig;
  readonly options: Required<FireChatOptions>;
  readonly adapter: StorageAdapter | undefined;
  readonly uploader: FileUploader | undefined;

  readonly rooms: RoomService;
  readonly messages: MessageService;
  readonly typing: TypingService;
  readonly readReceipts: ReadReceiptService;
  readonly presence: PresenceService;
  readonly users: UserResolverService | null;

  private currentUser: ChatUser | null = null;
  private authReady: Promise<void>;
  private unsubscribeAuth: (() => void) | null = null;

  private constructor(config: FireChatConfig) {
    this.config = config;
    this.options = { ...DEFAULT_OPTIONS, ...config.options };
    this.adapter = config.adapter;
    this.uploader = config.uploader;

    this.firestore = getFirestore(config.firebaseApp);
    this.auth = getAuth(config.firebaseApp);
    this.database = this.options.enablePresence
      ? getDatabase(config.firebaseApp)
      : null;

    this.authReady = this.initAuth();

    this.rooms = new RoomService(this);
    this.messages = new MessageService(this);
    this.typing = new TypingService(this);
    this.readReceipts = new ReadReceiptService(this);
    this.presence = new PresenceService(this);
    this.users = config.userResolver
      ? new UserResolverService(this, config.userResolver)
      : null;
  }

  static init(config: FireChatConfig): FireChat {
    if (FireChat.instance) {
      FireChat.instance.destroy();
    }
    FireChat.instance = new FireChat(config);
    return FireChat.instance;
  }

  static getInstance(): FireChat {
    if (!FireChat.instance) {
      throw new Error(
        'FireChat not initialized. Call FireChat.init(config) first.',
      );
    }
    return FireChat.instance;
  }

  private async initAuth(): Promise<void> {
    const { auth: authConfig } = this.config;

    if (authConfig.type === 'firebase') {
      return new Promise<void>((resolve) => {
        this.unsubscribeAuth = onAuthStateChanged(this.auth, (user) => {
          if (user) {
            this.currentUser = this.firebaseUserToChatUser(user);
          } else {
            this.currentUser = null;
          }
          resolve();
        });
      });
    }

    if (authConfig.type === 'anonymous') {
      const credential = await signInAnonymously(this.auth);
      this.currentUser = {
        id: credential.user.uid,
        displayName: authConfig.displayName ?? `Guest_${credential.user.uid.slice(0, 6)}`,
      };
      return;
    }

    if (authConfig.type === 'custom-token') {
      const token = await authConfig.getToken();
      await signInWithCustomToken(this.auth, token);
      const user = await authConfig.getUser();
      this.currentUser = user;
      return;
    }
  }

  private firebaseUserToChatUser(user: FirebaseUser): ChatUser {
    return {
      id: user.uid,
      displayName: user.displayName ?? `User_${user.uid.slice(0, 6)}`,
      avatarUrl: user.photoURL ?? undefined,
    };
  }

  async waitForAuth(): Promise<void> {
    await this.authReady;
  }

  getCurrentUser(): ChatUser {
    if (!this.currentUser) {
      throw new Error(
        'User not authenticated. Ensure auth is configured and user is signed in.',
      );
    }
    return this.currentUser;
  }

  /** Get Firestore collection path with prefix */
  getCollectionPath(name: string): string {
    return `${this.options.collectionPrefix}_${name}`;
  }

  /** Get rooms collection path */
  get roomsCollection(): string {
    return this.getCollectionPath('rooms');
  }

  destroy(): void {
    this.unsubscribeAuth?.();
    this.presence.destroy();
    this.users?.clearCache();
    this.currentUser = null;
    FireChat.instance = null;
  }
}
