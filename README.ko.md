# firechat-sdk

Firebase 설정만으로 React / React Native 앱에 실시간 채팅 기능을 추가하세요.

[English Documentation](./README.md)

## 주요 기능

- **간편한 설정** — Firebase config만 넣으면 바로 채팅 시작
- **실시간 메시징** — Firestore `onSnapshot` 기반 실시간 업데이트
- **커서 기반 페이지네이션** — 무한 스크롤 지원, 효율적인 메시지 로딩
- **타이핑 인디케이터** — 상대방 입력 중 표시 (자동 타임아웃)
- **읽음 처리 & 안읽은 수** — 유저별 읽음 상태 추적
- **유저 프레젠스** — Firebase RTDB 기반 온라인/오프라인 상태
- **유연한 인증** — Firebase Auth, Custom Token (자체 백엔드), 비회원(익명) 모두 지원
- **공개방** — 누구나 검색하고 참여할 수 있는 공개 채팅방
- **이미지/파일 메시지** — 이미지/파일 전송, 플러그인 방식 `FileUploader` 지원
- **유저 프로필 리졸버** — 메시지의 senderId를 DB의 이름/아바타로 매핑
- **RDB 연동** — `StorageAdapter` 인터페이스로 MySQL, PostgreSQL 등과 동기화
- **React Hooks** — `useChatRooms`, `useMessages`, `useTypingUsers` 등
- **React Native 호환** — 웹과 모바일 모두 지원

## 설치

```bash
npm install firechat-sdk firebase
```

## Firebase 프로젝트 설정

1. [Firebase Console](https://console.firebase.google.com/)에서 새 프로젝트를 생성하거나 기존 프로젝트를 사용합니다
2. **웹 앱 추가**: 프로젝트 설정 (톱니바퀴) → 일반 → 내 앱 → 앱 추가 → 웹 (`</>`)
3. 설정 값을 복사합니다:

```
apiKey            → API 키
authDomain        → your-project.firebaseapp.com
projectId         → 프로젝트 ID
storageBucket     → your-project.appspot.com
messagingSenderId → 발신자 ID
appId             → 앱 ID
```

4. **Firestore 활성화**: 빌드 → Firestore Database → 데이터베이스 만들기
5. **Authentication 활성화**: 빌드 → Authentication → 시작하기 → 사용할 로그인 방법 활성화:
   - `anonymous` 인증 타입: **익명** 활성화
   - `firebase` 인증 타입: **이메일/비밀번호**, **Google** 등 활성화
   - `custom-token` 인증 타입: 추가 설정 불필요 (서버에서 Firebase Admin SDK 사용)
6. **(선택) Realtime Database 활성화**: 빌드 → Realtime Database → 데이터베이스 만들기 (`enablePresence: true` 사용 시에만 필요)
7. **Firestore 인덱스 생성**: 처음 쿼리 실행 시 `The query requires an index` 에러가 발생할 수 있습니다. 에러 메시지에 포함된 링크를 클릭하면 Firebase Console에서 자동으로 필요한 인덱스를 생성할 수 있습니다. 필요한 복합 인덱스:

| 컬렉션 | 필드 | 정렬 |
|--------|------|------|
| `{prefix}_rooms` | `memberIds` (배열 포함) + `updatedAt` (내림차순) | 내림차순 |
| `{prefix}_rooms` | `isPublic` (오름차순) + `updatedAt` (내림차순) | 내림차순 |

## 아키텍처

```
┌──────────────────────────────────────────────────┐
│                   Client App                      │
│                                                   │
│  ┌──────────────┐          ┌──────────────────┐  │
│  │  메인 앱     │          │   채팅 UI        │  │
│  │  (로그인,    │          │  (firechat-sdk)  │  │
│  │   프로필,    │          │                  │  │
│  │   기타)      │          │                  │  │
│  └──────┬───────┘          └────────┬─────────┘  │
│         │                           │             │
└─────────┼───────────────────────────┼─────────────┘
          │                           │
          │ REST API                  │ 실시간 (onSnapshot)
          │                           │
┌─────────▼────────┐        ┌────────▼──────────┐
│   백엔드 서버    │        │    Firestore      │
│   (Express,      │◄───────│    (NoSQL)        │
│    NestJS 등)    │ Adapter│                   │
│                  │  Hook  │  firechat_rooms/   │
│  ┌────────────┐  │        │    ├── messages/   │
│  │  MySQL /   │  │        │    └── members/    │
│  │ PostgreSQL │  │        │                   │
│  └────────────┘  │        └───────────────────┘
└──────────────────┘
```

- **Firestore** = 실시간 메시지 전달 레이어
- **RDBMS** = 비즈니스 데이터의 원본 (유저, 프로필 등)
- **StorageAdapter** = Firestore 이벤트를 서버로 동기화하는 브릿지

## 빠른 시작

### 1. 초기화

```typescript
import { FireChat } from 'firechat-sdk';
import { initializeApp } from 'firebase/app';

const app = initializeApp({
  apiKey: 'your-api-key',
  projectId: 'your-project-id',
  // ...기타 설정
});

const chat = FireChat.init({
  firebaseApp: app,
  auth: { type: 'firebase' }, // 다른 인증 방식은 아래 참고
});
```

### 2. React에서 사용

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

  if (loading) return <p>로딩 중...</p>;

  return (
    <ul>
      {rooms.map(room => (
        <li key={room.id}>
          {room.name ?? '1:1 채팅'} — {room.lastMessage?.text}
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
      {hasMore && <button onClick={loadMore}>이전 메시지 불러오기</button>}
      {messages.map(msg => (
        <div key={msg.id}>
          <strong>{msg.senderId}</strong>: {msg.text}
        </div>
      ))}
      {typingUserIds.length > 0 && <p>상대방이 입력 중...</p>}
      <input
        onChange={() => startTyping()}
        onBlur={() => stopTyping()}
      />
    </div>
  );
}
```

## 인증 방식

### Firebase Auth

Firebase 인증을 이미 사용하는 서비스에 적합합니다.

```typescript
FireChat.init({
  firebaseApp: app,
  auth: { type: 'firebase' },
});
```

Firebase Console → Authentication이 설정되어 있어야 합니다. FireChat 초기화 전에 유저가 로그인되어 있어야 합니다.

### Custom Token (RDBMS 기반 서비스에 권장)

자체 백엔드와 인증 시스템(JWT, 세션 등)을 사용하는 서비스에 적합합니다. [Firebase Custom Token](https://firebase.google.com/docs/auth/admin/create-custom-tokens)을 사용하여 기존 인증을 Firestore에 안전하게 연결합니다.

```typescript
FireChat.init({
  firebaseApp: app,
  auth: {
    type: 'custom-token',
    getToken: async () => {
      // 서버에서 Firebase Custom Token을 받아옴
      const res = await fetch('/api/chat/token', {
        headers: { Authorization: `Bearer ${yourJwt}` },
      });
      const { token } = await res.json();
      return token;
    },
    getUser: () => ({
      id: 'user_123',        // Custom Token 생성 시 사용한 uid와 동일해야 함
      displayName: '홍길동',
      avatarUrl: 'https://example.com/avatar.jpg',
    }),
  },
});
```

**서버측** — Firebase Custom Token을 생성하는 엔드포인트 하나만 추가하면 됩니다:

```typescript
// Express / NestJS 등
import admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.post('/api/chat/token', authenticateJWT, async (req, res) => {
  const userId = req.user.id; // RDBMS의 user PK

  // RDBMS의 userId로 Firebase Custom Token 생성
  const customToken = await admin.auth().createCustomToken(userId);

  res.json({ token: customToken });
});
```

이렇게 하면 Firestore Security Rules의 `request.auth.uid`가 RDBMS의 user ID와 동일해져서, 적절한 접근 제어가 가능합니다.

### Anonymous (비회원)

비회원 채팅, 고객 상담, 데모 등에 적합합니다. Firebase Console에서 익명 인증을 활성화해야 합니다.

```typescript
FireChat.init({
  firebaseApp: app,
  auth: {
    type: 'anonymous',
    displayName: '게스트', // 선택
  },
});
```

### 비교

| 인증 타입 | Firebase Auth | uid = DB의 PK | Security Rules | 적합한 경우 |
|-----------|:---:|:---:|:---:|----------|
| `firebase` | O | Firebase uid | O | Firebase Auth 사용 서비스 |
| `custom-token` | O (Custom Token) | **O** | **O** | **RDBMS 기반 서비스** |
| `anonymous` | O (Anonymous) | X (랜덤) | 제한적 | 비회원 채팅, 데모 |

## 공개방

채팅방을 공개로 설정하면 인증된 모든 유저가 검색하고 참여할 수 있습니다.

### 공개방 생성

```typescript
const room = await chat.rooms.create({
  type: 'group',
  name: '자유 채팅',
  memberIds: [],
  isPublic: true,
});
```

### 공개방 조회 & 참여

```typescript
// 일회성 조회
const publicRooms = await chat.rooms.listPublic({ limit: 20 });

// 실시간 구독
const unsubscribe = chat.rooms.subscribePublic((rooms) => {
  console.log('공개방 목록:', rooms);
}, { limit: 20 });

// 공개방 참여
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
          {room.name} <button onClick={() => handleJoin(room.id)}>참여</button>
        </li>
      ))}
    </ul>
  );
}
```

## 이미지/파일 메시지

`type: 'image'`와 `type: 'file'` 메시지를 지원합니다.

### URL로 전송 (RDBMS 유저)

대부분의 유저는 자체 CDN/S3에 업로드 후 URL을 전달합니다:

```typescript
await chat.messages.send(roomId, {
  type: 'image',
  mediaUrl: 'https://my-cdn.com/photo.jpg',
  thumbnailUrl: 'https://my-cdn.com/photo_thumb.jpg',
  text: '사진입니다!',
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

### FileUploader로 전송 (Firebase Storage)

Firebase Storage 유저를 위한 내장 업로더:

```typescript
import { FirebaseStorageUploader } from 'firechat-sdk';
import { getStorage } from 'firebase/storage';

const chat = FireChat.init({
  firebaseApp: app,
  auth: { type: 'firebase' },
  uploader: new FirebaseStorageUploader(getStorage(app)),
});

// 업로드 + 전송을 한 번에
await chat.messages.sendImage(roomId, {
  file: imageFile, // 브라우저 File 또는 RN { uri }
  text: '오늘 사진',
  onProgress: (p) => console.log(`${p.progress}%`),
});

await chat.messages.sendFile(roomId, {
  file: documentFile,
  text: '회의 자료',
});
```

### 커스텀 FileUploader

자체 스토리지용 `FileUploader` 인터페이스 구현:

```typescript
import type { FileUploader } from 'firechat-sdk';

const myUploader: FileUploader = {
  async upload(file, path, onProgress) {
    // CDN/S3에 업로드
    return { url: '...', path, size: file.size, mimeType: file.type };
  },
  async delete(path) {
    // 스토리지에서 삭제
  },
};
```

## 유저 프로필 리졸버

메시지의 `senderId`를 DB의 유저 프로필(이름, 아바타)과 매핑합니다.

### 설정

```typescript
const chat = FireChat.init({
  firebaseApp: app,
  auth: { type: 'custom-token', getToken, getUser },
  userResolver: async (userId) => {
    const res = await fetch(`/api/users/${userId}`);
    return res.json(); // { id, displayName, avatarUrl }
  },
  options: {
    userResolverCacheTTL: 300000, // 5분 캐시 (기본값)
  },
});
```

### 자동 sender 정보 주입

`userResolver`가 설정되면 `useMessages()`가 자동으로 sender 프로필을 메시지에 추가합니다:

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

### 수동 조회

```typescript
// 단일 유저
const user = await chat.users.resolve(userId);

// 여러 유저
const users = await chat.users.resolveMany([userId1, userId2]);

// 캐시 조회 (동기)
const cached = chat.users.getCached(userId);

// 캐시 관리
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

운영 환경에서 권장하는 보안 규칙:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /firechat_rooms/{roomId} {
      // 방 멤버 또는 공개방은 읽기 가능
      allow read: if request.auth.uid in resource.data.memberIds
        || resource.data.isPublic == true;

      // 인증된 유저면 방 생성 가능
      allow create: if request.auth != null;

      // 방 멤버만 수정 가능
      allow update: if request.auth.uid in resource.data.memberIds;

      match /messages/{messageId} {
        // 방 멤버만 메시지 읽기 가능
        allow read: if request.auth.uid in
          get(/databases/$(database)/documents/firechat_rooms/$(roomId)).data.memberIds;

        // 방 멤버만 메시지 전송 가능, senderId는 본인만
        allow create: if request.auth.uid == request.resource.data.senderId
          && request.auth.uid in
          get(/databases/$(database)/documents/firechat_rooms/$(roomId)).data.memberIds;

        // 본인 메시지만 수정/삭제 가능
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

> **참고**: 커스텀 `collectionPrefix`를 사용하는 경우 `firechat_rooms`를 `{yourPrefix}_rooms`로 변경하세요.

## 관계형 데이터베이스 연동

`StorageAdapter` 인터페이스를 구현하면 채팅 이벤트를 서버와 동기화할 수 있습니다:

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

### StorageAdapter 메서드

모든 메서드는 선택사항입니다 — 필요한 것만 구현하세요.

| 메서드 | 호출 시점 |
|--------|----------|
| `onRoomCreated(room)` | 채팅방 생성 후 |
| `onRoomUpdated(roomId, updates)` | 채팅방 정보 수정 후 |
| `onRoomDeleted(roomId)` | 채팅방 삭제 후 |
| `onMessageSent(roomId, message)` | 메시지 전송 후 |
| `onMessageUpdated(roomId, message)` | 메시지 수정 후 |
| `onMessageDeleted(roomId, messageId)` | 메시지 삭제 후 |
| `onMemberJoined(roomId, user)` | 멤버 추가 후 |
| `onMemberLeft(roomId, userId)` | 멤버 퇴장 후 |

## 설정 옵션

```typescript
FireChat.init({
  firebaseApp: app,
  auth: { type: 'custom-token', getToken, getUser },
  adapter,            // 선택
  uploader,           // 선택 — 이미지/파일 업로드용 FileUploader
  userResolver,       // 선택 — async (userId) => ChatUser
  options: {
    collectionPrefix: 'firechat',     // Firestore 컬렉션 접두어 (기본: 'firechat')
    enablePresence: false,            // 온라인/오프라인 추적 (기본: false)
    enableTypingIndicator: true,      // 타이핑 인디케이터 (기본: true)
    enableReadReceipts: true,         // 읽음 처리 (기본: true)
    pageSize: 30,                     // 페이지당 메시지 수 (기본: 30)
    typingTimeout: 5000,              // 타이핑 자동 해제 시간 ms (기본: 5000)
    userResolverCacheTTL: 300000,     // 유저 프로필 캐시 TTL ms (기본: 300000)
  },
});
```

## React Hooks

| Hook | 설명 |
|------|------|
| `useFireChat()` | FireChat 인스턴스 및 현재 유저 접근 |
| `useChatRooms()` | 실시간 채팅방 목록 |
| `useMessages(roomId)` | 메시지 목록 + 페이지네이션 + 실시간 |
| `useRoom(roomId)` | 단일 채팅방 정보 (실시간) |
| `useTypingUsers(roomId)` | 타이핑 인디케이터 상태 및 제어 |
| `useUnreadCount(roomId)` | 안읽은 메시지 수 |
| `usePresence(userId)` | 유저 온라인/오프라인 상태 |
| `usePublicRooms(options?)` | 실시간 공개방 목록 |
| `useUser(userId)` | UserResolver로 유저 프로필 조회 |

## Core API (React 없이 사용)

```typescript
const chat = FireChat.getInstance();

// 채팅방
const room = await chat.rooms.create({ type: 'direct', memberIds: ['user-2'] });
const room = await chat.rooms.getOrCreateDirect('user-2'); // 1:1 채팅 (있으면 기존 반환)
const unsubscribe = chat.rooms.subscribe((rooms) => console.log(rooms));

// 메시지
const msg = await chat.messages.send(roomId, { type: 'text', text: '안녕하세요!' });
const { messages, hasMore } = await chat.messages.fetch(roomId);
const unsubscribe = chat.messages.subscribe(roomId, (newMsgs) => { ... });

// 타이핑
await chat.typing.startTyping(roomId);
await chat.typing.stopTyping(roomId);

// 읽음 처리
await chat.readReceipts.markAsRead(roomId);
const count = await chat.readReceipts.getUnreadCount(roomId);

// 공개방
const publicRooms = await chat.rooms.listPublic({ limit: 20 });
const unsubscribe = chat.rooms.subscribePublic((rooms) => { ... });
await chat.rooms.join(publicRoomId);

// 이미지/파일 메시지
await chat.messages.sendImage(roomId, { file: imageFile });
await chat.messages.sendFile(roomId, { file: documentFile });

// 유저 리졸버
const user = await chat.users?.resolve(userId);

// 프레젠스
chat.presence.subscribe(userId, ({ isOnline, lastSeenAt }) => { ... });

// 정리
chat.destroy();
```

## Firestore 구조

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

## 라이선스

MIT
