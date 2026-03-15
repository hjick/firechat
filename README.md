# firechat-sdk

Add real-time chat to any React or React Native app with just a Firebase config.

[한국어 문서](./README.ko.md)

## Features

- **Easy Setup** — Initialize with your Firebase config and start chatting
- **Real-time Messaging** — Powered by Firestore `onSnapshot` listeners
- **Cursor-based Pagination** — Efficient message loading with infinite scroll support
- **Typing Indicators** — Show who's typing with auto-timeout
- **Read Receipts & Unread Counts** — Track read status per user
- **User Presence** — Online/offline status via Firebase RTDB
- **Flexible Auth** — Firebase Auth, Custom Token (for your own backend), or anonymous guests
- **RDB Sync** — `StorageAdapter` interface for syncing with MySQL, PostgreSQL, etc.
- **Public Rooms** — Create public rooms that anyone can discover and join
- **Image & File Messages** — Send images/files with optional upload via pluggable `FileUploader`
- **User Profile Resolver** — Map sender IDs to display names and avatars from your database
- **React Hooks** — `useChatRooms`, `useMessages`, `useTypingUsers`, and more
- **React Native Compatible** — Works with both React and React Native

## Installation

```bash
npm install firechat-sdk firebase
```

## Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a new project (or use an existing one)
2. **Add a Web App**: Project Settings (gear icon) → General → Your apps → Add app → Web (`</>`)
3. Copy the config values:

```
apiKey            → Your API key
authDomain        → your-project.firebaseapp.com
projectId         → Your project ID
storageBucket     → your-project.appspot.com
messagingSenderId → Your sender ID
appId             → Your app ID
```

4. **Enable Firestore**: Build → Firestore Database → Create database
5. **Enable Authentication**: Build → Authentication → Get started → Enable your preferred sign-in method:
   - For `anonymous` auth type: enable **Anonymous**
   - For `firebase` auth type: enable **Email/Password**, **Google**, etc.
   - For `custom-token` auth type: no additional setup needed (uses Firebase Admin SDK on your server)
6. **(Optional) Enable Realtime Database**: Build → Realtime Database → Create database (required only if `enablePresence: true`)
7. **Create Firestore Indexes**: The first time you run a query, Firestore may show an error like `The query requires an index`. Click the link in the error message to automatically create the required index in Firebase Console. The following composite indexes are required:

| Collection | Fields | Order |
|------------|--------|-------|
| `{prefix}_rooms` | `memberIds` (Array contains) + `updatedAt` (Descending) | Descending |
| `{prefix}_rooms` | `isPublic` (Ascending) + `updatedAt` (Descending) | Descending |

## Architecture

```
┌──────────────────────────────────────────────────┐
│                   Client App                      │
│                                                   │
│  ┌──────────────┐          ┌──────────────────┐  │
│  │  Main App    │          │   Chat UI        │  │
│  │  (login,     │          │  (firechat-sdk)  │  │
│  │   profile,   │          │                  │  │
│  │   etc.)      │          │                  │  │
│  └──────┬───────┘          └────────┬─────────┘  │
│         │                           │             │
└─────────┼───────────────────────────┼─────────────┘
          │                           │
          │ REST API                  │ Real-time (onSnapshot)
          │                           │
┌─────────▼────────┐        ┌────────▼──────────┐
│   Your Server    │        │    Firestore      │
│   (Express,      │◄───────│    (NoSQL)        │
│    NestJS, etc.) │ Adapter│                   │
│                  │  Hook  │  firechat_rooms/   │
│  ┌────────────┐  │        │    ├── messages/   │
│  │  MySQL /   │  │        │    └── members/    │
│  │ PostgreSQL │  │        │                   │
│  └────────────┘  │        └───────────────────┘
└──────────────────┘
```

- **Firestore** = Real-time message delivery layer
- **Your RDBMS** = Source of truth for business data (users, profiles, etc.)
- **StorageAdapter** = Bridge that syncs Firestore events to your server

## Quick Start

### 1. Initialize

```typescript
import { FireChat } from 'firechat-sdk';
import { initializeApp } from 'firebase/app';

const app = initializeApp({
  apiKey: 'your-api-key',
  projectId: 'your-project-id',
  // ...other config
});

const chat = FireChat.init({
  firebaseApp: app,
  auth: { type: 'firebase' }, // See Authentication section for other options
});
```

### 2. Use with React

```tsx
import {
  FireChatProvider,
  useChatRooms,
  useMessages,
  useTypingUsers,
  useUnreadCount,
} from 'firechat-sdk';

function App() {
  return (
    <FireChatProvider config={firechatConfig}>
      <ChatApp />
    </FireChatProvider>
  );
}

function ChatRoomList() {
  const { rooms, loading } = useChatRooms();

  if (loading) return <p>Loading...</p>;

  return (
    <ul>
      {rooms.map(room => (
        <li key={room.id}>
          {room.name ?? 'Direct Chat'} — {room.lastMessage?.text}
        </li>
      ))}
    </ul>
  );
}

function ChatScreen({ roomId }: { roomId: string }) {
  const { messages, send, loadMore, hasMore } = useMessages(roomId);
  const { typingUserIds, startTyping, stopTyping } = useTypingUsers(roomId);
  const { count: unreadCount } = useUnreadCount(roomId);

  return (
    <div>
      {hasMore && <button onClick={loadMore}>Load More</button>}
      {messages.map(msg => (
        <div key={msg.id}>
          <strong>{msg.senderId}</strong>: {msg.text}
        </div>
      ))}
      {typingUserIds.length > 0 && <p>Someone is typing...</p>}
      <input
        onChange={() => startTyping()}
        onBlur={() => stopTyping()}
      />
    </div>
  );
}
```

## Authentication

### Firebase Auth

For apps already using Firebase Authentication.

```typescript
FireChat.init({
  firebaseApp: app,
  auth: { type: 'firebase' },
});
```

Firebase Console → Authentication must be set up. User must be signed in before initializing FireChat.

### Custom Token (Recommended for RDBMS-based services)

For apps with their own backend and authentication system (JWT, sessions, etc.). Uses [Firebase Custom Tokens](https://firebase.google.com/docs/auth/admin/create-custom-tokens) to securely bridge your auth to Firestore.

```typescript
FireChat.init({
  firebaseApp: app,
  auth: {
    type: 'custom-token',
    getToken: async () => {
      // Call your server to get a Firebase Custom Token
      const res = await fetch('/api/chat/token', {
        headers: { Authorization: `Bearer ${yourJwt}` },
      });
      const { token } = await res.json();
      return token;
    },
    getUser: () => ({
      id: 'user_123',        // Must match the uid used to create the custom token
      displayName: 'John',
      avatarUrl: 'https://example.com/avatar.jpg',
    }),
  },
});
```

**Server-side** — Add one endpoint to generate Firebase Custom Tokens:

```typescript
// Express / NestJS / etc.
import admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.post('/api/chat/token', authenticateJWT, async (req, res) => {
  const userId = req.user.id; // Your RDBMS user PK

  // Create a Firebase Custom Token with your user's ID
  const customToken = await admin.auth().createCustomToken(userId);

  res.json({ token: customToken });
});
```

This way, `request.auth.uid` in Firestore Security Rules equals your RDBMS user ID, enabling proper access control.

### Anonymous (no sign-up required)

For guest chat, customer support, or demo scenarios. Requires enabling Anonymous Authentication in Firebase Console.

```typescript
FireChat.init({
  firebaseApp: app,
  auth: {
    type: 'anonymous',
    displayName: 'Guest User', // optional
  },
});
```

### Comparison

| Auth Type | Firebase Auth | uid = Your DB PK | Secure Rules | Best For |
|-----------|:---:|:---:|:---:|----------|
| `firebase` | Yes | Firebase uid | Yes | Firebase Auth users |
| `custom-token` | Yes (Custom Token) | **Yes** | **Yes** | **RDBMS-based services** |
| `anonymous` | Yes (Anonymous) | No (random) | Limited | Guest chat, demos |

## Public Rooms

Rooms can be marked as public so that any authenticated user can discover and join them.

### Creating a Public Room

```typescript
const room = await chat.rooms.create({
  type: 'group',
  name: 'General Chat',
  memberIds: [],
  isPublic: true,
});
```

### Browsing & Joining Public Rooms

```typescript
// One-time fetch
const publicRooms = await chat.rooms.listPublic({ limit: 20 });

// Real-time subscription
const unsubscribe = chat.rooms.subscribePublic((rooms) => {
  console.log('Public rooms:', rooms);
}, { limit: 20 });

// Join a public room
await chat.rooms.join(roomId);
```

### React Hook

```tsx
import { usePublicRooms } from 'firechat-sdk';

function PublicRoomList() {
  const { rooms, loading } = usePublicRooms({ limit: 20 });
  const { firechat } = useFireChat();

  const handleJoin = async (roomId: string) => {
    await firechat.rooms.join(roomId);
  };

  return (
    <ul>
      {rooms.map(room => (
        <li key={room.id}>
          {room.name} <button onClick={() => handleJoin(room.id)}>Join</button>
        </li>
      ))}
    </ul>
  );
}
```

## Image & File Messages

Messages support `type: 'image'` and `type: 'file'` with media URLs.

### Sending with URL (RDBMS users)

Most users will upload files to their own CDN/S3 and pass the URL:

```typescript
await chat.messages.send(roomId, {
  type: 'image',
  mediaUrl: 'https://my-cdn.com/photo.jpg',
  thumbnailUrl: 'https://my-cdn.com/photo_thumb.jpg',
  text: 'Check this out!',
});

await chat.messages.send(roomId, {
  type: 'file',
  mediaUrl: 'https://my-cdn.com/document.pdf',
  fileName: 'document.pdf',
  fileSize: 1024000,
  mimeType: 'application/pdf',
  text: '',
});
```

### Sending with FileUploader (Firebase Storage)

For Firebase Storage users, the SDK provides a built-in uploader:

```typescript
import { FirebaseStorageUploader } from 'firechat-sdk';
import { getStorage } from 'firebase/storage';

const chat = FireChat.init({
  firebaseApp: app,
  auth: { type: 'firebase' },
  uploader: new FirebaseStorageUploader(getStorage(app)),
});

// Upload and send in one call
await chat.messages.sendImage(roomId, {
  file: imageFile, // browser File or RN { uri }
  text: 'Photo from today',
  onProgress: (p) => console.log(`${p.progress}%`),
});

await chat.messages.sendFile(roomId, {
  file: documentFile,
  text: 'Meeting notes',
});
```

### Custom FileUploader

Implement the `FileUploader` interface for your own storage:

```typescript
import type { FileUploader } from 'firechat-sdk';

const myUploader: FileUploader = {
  async upload(file, path, onProgress) {
    // Upload to your CDN/S3
    return { url: '...', path, size: file.size, mimeType: file.type };
  },
  async delete(path) {
    // Delete from your storage
  },
};
```

## User Profile Resolver

Map message `senderId` to user profiles (display name, avatar) from your database.

### Setup

```typescript
const chat = FireChat.init({
  firebaseApp: app,
  auth: { type: 'custom-token', getToken, getUser },
  userResolver: async (userId) => {
    const res = await fetch(`/api/users/${userId}`);
    return res.json(); // { id, displayName, avatarUrl }
  },
  options: {
    userResolverCacheTTL: 300000, // 5 min cache (default)
  },
});
```

### Automatic sender enrichment

When `userResolver` is configured, `useMessages()` automatically enriches messages with sender profiles:

```tsx
function MessageBubble({ message }: { message: MessageWithSender }) {
  return (
    <div>
      <img src={message.sender?.avatarUrl} />
      <span>{message.sender?.displayName}</span>
      <p>{message.text}</p>
    </div>
  );
}
```

### Manual resolution

```typescript
// Single user
const user = await chat.users.resolve(userId);

// Multiple users
const users = await chat.users.resolveMany([userId1, userId2]);

// Cached (synchronous)
const cached = chat.users.getCached(userId);

// Cache management
chat.users.invalidate(userId);
chat.users.clearCache();
```

### React Hook

```tsx
import { useUser } from 'firechat-sdk';

function UserAvatar({ userId }: { userId: string }) {
  const { user, loading } = useUser(userId);
  if (loading) return <span>...</span>;
  return <img src={user?.avatarUrl} alt={user?.displayName} />;
}
```

## Firestore Security Rules

Recommended security rules for production:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /firechat_rooms/{roomId} {
      // Room members or public room viewers can read
      allow read: if request.auth.uid in resource.data.memberIds
        || resource.data.isPublic == true;

      // Any authenticated user can create a room
      allow create: if request.auth != null;

      // Only members can update the room
      allow update: if request.auth.uid in resource.data.memberIds;

      match /messages/{messageId} {
        // Only room members can read messages
        allow read: if request.auth.uid in
          get(/databases/$(database)/documents/firechat_rooms/$(roomId)).data.memberIds;

        // Only room members can send, senderId must match auth uid
        allow create: if request.auth.uid == request.resource.data.senderId
          && request.auth.uid in
          get(/databases/$(database)/documents/firechat_rooms/$(roomId)).data.memberIds;

        // Only the sender can update/delete their own messages
        allow update: if request.auth.uid == resource.data.senderId;
      }

      match /members/{userId} {
        allow read: if request.auth.uid in
          get(/databases/$(database)/documents/firechat_rooms/$(roomId)).data.memberIds;
        allow write: if request.auth != null;
      }
    }
  }
}
```

> **Note**: If you use a custom `collectionPrefix`, replace `firechat_rooms` with `{yourPrefix}_rooms`.

## Syncing with Relational Database

Implement the `StorageAdapter` interface to sync chat events with your server:

```typescript
import { FireChat, type StorageAdapter } from 'firechat-sdk';

const adapter: StorageAdapter = {
  async onMessageSent(roomId, message) {
    await fetch('/api/chat/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ roomId, ...message }),
    });
  },

  async onRoomCreated(room) {
    await fetch('/api/chat/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify(room),
    });
  },
};

FireChat.init({
  firebaseApp: app,
  auth: { type: 'custom-token', getToken, getUser },
  adapter,
});
```

### StorageAdapter Methods

All methods are optional — implement only what you need.

| Method | Trigger |
|--------|---------|
| `onRoomCreated(room)` | After a new room is created |
| `onRoomUpdated(roomId, updates)` | After a room is updated |
| `onRoomDeleted(roomId)` | After a room is deleted |
| `onMessageSent(roomId, message)` | After a message is sent |
| `onMessageUpdated(roomId, message)` | After a message is edited |
| `onMessageDeleted(roomId, messageId)` | After a message is deleted |
| `onMemberJoined(roomId, user)` | After a user joins a room |
| `onMemberLeft(roomId, userId)` | After a user leaves a room |

## Configuration Options

```typescript
FireChat.init({
  firebaseApp: app,
  auth: { type: 'custom-token', getToken, getUser },
  adapter,            // optional
  uploader,           // optional — FileUploader for image/file uploads
  userResolver,       // optional — async (userId) => ChatUser
  options: {
    collectionPrefix: 'firechat',     // Firestore collection prefix (default: 'firechat')
    enablePresence: false,            // Enable online/offline tracking (default: false)
    enableTypingIndicator: true,      // Enable typing indicators (default: true)
    enableReadReceipts: true,         // Enable read receipts (default: true)
    pageSize: 30,                     // Messages per page (default: 30)
    typingTimeout: 5000,              // Auto-stop typing after ms (default: 5000)
    userResolverCacheTTL: 300000,     // User profile cache TTL in ms (default: 300000)
  },
});
```

## React Hooks

| Hook | Description |
|------|-------------|
| `useFireChat()` | Access FireChat instance and current user |
| `useChatRooms()` | Real-time list of chat rooms |
| `useMessages(roomId)` | Messages with pagination and real-time updates |
| `useRoom(roomId)` | Single room details with real-time updates |
| `useTypingUsers(roomId)` | Typing indicator state and controls |
| `useUnreadCount(roomId)` | Unread message count |
| `usePresence(userId)` | User online/offline status |
| `usePublicRooms(options?)` | Real-time list of public rooms |
| `useUser(userId)` | Resolve user profile from UserResolver |

## Core API (without React)

```typescript
const chat = FireChat.getInstance();

// Rooms
const room = await chat.rooms.create({ type: 'direct', memberIds: ['user-2'] });
const room = await chat.rooms.getOrCreateDirect('user-2');
const unsubscribe = chat.rooms.subscribe((rooms) => console.log(rooms));

// Public Rooms
const publicRooms = await chat.rooms.listPublic({ limit: 20 });
const unsubscribe = chat.rooms.subscribePublic((rooms) => { ... });
await chat.rooms.join(publicRoomId);

// Messages
const msg = await chat.messages.send(roomId, { type: 'text', text: 'Hello!' });
const { messages, hasMore } = await chat.messages.fetch(roomId);
const unsubscribe = chat.messages.subscribe(roomId, (newMsgs) => { ... });

// Image / File messages
await chat.messages.sendImage(roomId, { file: imageFile });
await chat.messages.sendFile(roomId, { file: documentFile });

// User Resolver
const user = await chat.users?.resolve(userId);

// Typing
await chat.typing.startTyping(roomId);
await chat.typing.stopTyping(roomId);

// Read Receipts
await chat.readReceipts.markAsRead(roomId);
const count = await chat.readReceipts.getUnreadCount(roomId);

// Presence
chat.presence.subscribe(userId, ({ isOnline, lastSeenAt }) => { ... });

// Cleanup
chat.destroy();
```

## Firestore Structure

```
{prefix}_rooms/{roomId}
  ├── type, name, createdBy, createdAt, updatedAt
  ├── memberIds: string[]
  ├── isPublic: boolean
  ├── lastMessage: { text, senderId, sentAt, type }
  ├── typingUserIds: string[]
  │
  ├── /messages/{messageId}
  │     └── senderId, type, text, mediaUrl, thumbnailUrl,
  │         fileName, fileSize, mimeType, createdAt, status, replyTo, ...
  │
  └── /members/{userId}
        └── role, joinedAt, lastReadAt
```

## License

MIT
