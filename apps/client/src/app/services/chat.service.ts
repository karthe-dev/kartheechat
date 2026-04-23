import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';
import { AuthService } from './auth.service';

const API = 'http://localhost:3000/api/chat';

export interface Room {
  id: string;
  name: string;
  isGroup: boolean;
  members: string[];
  joinedAt?: Record<string, number>;
  pinnedMessageId?: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  roomId: string;
  timestamp: number;
  isSystem?: boolean;
  reactions?: Record<string, string[]>;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  forwarded?: boolean;
  forwardedFrom?: string;
  deletedFor?: string[];
  deletedForEveryone?: boolean;
  replyToId?: string;
  replyToContent?: string;
  replyToSender?: string;
  status?: 'sent' | 'delivered' | 'read';
  readBy?: string[];
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private socket!: Socket;
  rooms = signal<Room[]>([]);
  allGroups = signal<Room[]>([]);
  activeMessages = signal<Message[]>([]);
  activeRoom = signal<Room | null>(null);
  typingUsers = signal<Map<string, string>>(new Map());
  roomTypingUsers = signal<Map<string, Map<string, string>>>(new Map());
  newGroupAvailable = signal(false);
  onlineUserIds = signal<Set<string>>(new Set());
  unreadCounts = signal<Map<string, number>>(new Map());
  lastMessages = signal<Map<string, Message>>(new Map());
  pinnedMessage = signal<Message | null>(null);

  onIncomingMessage: ((msg: Message) => void) | null = null;

  constructor(private http: HttpClient, private auth: AuthService) {}

  connect() {
    this.socket = io('http://localhost:3000', { auth: { token: this.auth.token } });
    this.loadAllGroups();

    this.socket.on('newMessage', (msg: Message) => {
      const userRoomIds = this.rooms().map((r) => r.id);
      if (!userRoomIds.includes(msg.roomId)) return;

      // Update last message for this room
      this.lastMessages.update((m) => new Map(m).set(msg.roomId, msg));

      if (msg.roomId === this.activeRoom()?.id) {
        this.activeMessages.update((msgs) => [...msgs, msg]);
      } else {
        // Increment unread count for non-active rooms
        this.unreadCounts.update((m) => {
          const n = new Map(m);
          n.set(msg.roomId, (n.get(msg.roomId) || 0) + 1);
          return n;
        });
      }
      if (this.onIncomingMessage) this.onIncomingMessage(msg);
    });

    this.socket.on('typing', (data: { userId: string; username: string; roomId: string }) => {
      // Track per-room typing
      this.roomTypingUsers.update((rm) => {
        const n = new Map(rm);
        const roomMap = new Map(n.get(data.roomId) || []);
        roomMap.set(data.userId, data.username);
        n.set(data.roomId, roomMap);
        return n;
      });
      if (data.roomId === this.activeRoom()?.id) {
        this.typingUsers.update((m) => new Map(m).set(data.userId, data.username));
      }
    });

    this.socket.on('stopTyping', (data: { userId: string; roomId?: string }) => {
      // Clear from per-room tracking
      this.roomTypingUsers.update((rm) => {
        const n = new Map(rm);
        for (const [roomId, userMap] of n.entries()) {
          if (userMap.has(data.userId)) {
            const updated = new Map(userMap);
            updated.delete(data.userId);
            if (updated.size === 0) n.delete(roomId);
            else n.set(roomId, updated);
          }
        }
        return n;
      });
      this.typingUsers.update((m) => { const n = new Map(m); n.delete(data.userId); return n; });
    });

    this.socket.on('roomCreated', (room: Room) => {
      const userId = this.auth.user()?.id;
      if (userId && room.members.includes(userId)) {
        this.rooms.update((rooms) => {
          if (rooms.find((r) => r.id === room.id)) return rooms;
          return [...rooms, room];
        });
      }
    });

    this.socket.on('groupListUpdated', (room: Room) => {
      this.allGroups.update((groups) => {
        const idx = groups.findIndex((g) => g.id === room.id);
        if (idx >= 0) { const u = [...groups]; u[idx] = room; return u; }
        return [...groups, room];
      });
      const userId = this.auth.user()?.id;
      if (userId && !room.members.includes(userId)) this.newGroupAvailable.set(true);
    });

    this.socket.on('userJoined', (data: { room: Room }) => {
      this.rooms.update((rooms) => {
        const idx = rooms.findIndex((r) => r.id === data.room.id);
        if (idx >= 0) { const u = [...rooms]; u[idx] = data.room; return u; }
        return rooms;
      });
      this.allGroups.update((groups) => {
        const idx = groups.findIndex((g) => g.id === data.room.id);
        if (idx >= 0) { const u = [...groups]; u[idx] = data.room; return u; }
        return groups;
      });
      if (this.activeRoom()?.id === data.room.id) this.activeRoom.set(data.room);
    });

    this.socket.on('userLeft', (data: { room: Room; leftUserId?: string }) => {
      const myId = this.auth.user()?.id;
      if (data.leftUserId === myId) {
        // I left the group — remove from my rooms, clear active if viewing it
        this.rooms.update((rooms) => rooms.filter((r) => r.id !== data.room.id));
        if (this.activeRoom()?.id === data.room.id) {
          this.activeRoom.set(null);
          this.activeMessages.set([]);
        }
      } else {
        // Someone else left — update room members
        this.rooms.update((rooms) => {
          const idx = rooms.findIndex((r) => r.id === data.room.id);
          if (idx >= 0) { const u = [...rooms]; u[idx] = data.room; return u; }
          return rooms;
        });
        if (this.activeRoom()?.id === data.room.id) this.activeRoom.set(data.room);
      }
      this.allGroups.update((groups) => {
        const idx = groups.findIndex((g) => g.id === data.room.id);
        if (idx >= 0) { const u = [...groups]; u[idx] = data.room; return u; }
        return groups;
      });
    });

    // Online/Offline tracking
    this.socket.on('userOnline', (data: { userId: string }) => {
      this.onlineUserIds.update((s) => new Set(s).add(data.userId));
    });

    this.socket.on('userOffline', (data: { userId: string }) => {
      this.onlineUserIds.update((s) => { const n = new Set(s); n.delete(data.userId); return n; });
    });

    this.socket.on('onlineUsersList', (ids: string[]) => {
      this.onlineUserIds.set(new Set(ids));
    });

    this.socket.on('messageReacted', (msg: Message) => {
      this.activeMessages.update((msgs) =>
        msgs.map((m) => m.id === msg.id ? { ...m, reactions: msg.reactions } : m)
      );
    });

    this.socket.on('messagePinned', (data: { room: Room; pinnedMessage: Message | null }) => {
      if (this.activeRoom()?.id === data.room.id) {
        this.activeRoom.set(data.room);
        this.pinnedMessage.set(data.pinnedMessage);
      }
      this.rooms.update((rooms) => {
        const idx = rooms.findIndex((r) => r.id === data.room.id);
        if (idx >= 0) { const u = [...rooms]; u[idx] = data.room; return u; }
        return rooms;
      });
    });

    this.socket.on('messageDeleted', (msg: Message) => {
      this.activeMessages.update((msgs) =>
        msgs.map((m) => m.id === msg.id ? msg : m)
      );
    });

    this.socket.on('messagesDelivered', (data: { roomId: string }) => {
      this.activeMessages.update((msgs) =>
        msgs.map((m) => m.roomId === data.roomId && m.status === 'sent' ? { ...m, status: 'delivered' as const } : m)
      );
    });

    this.socket.on('messagesRead', (data: { roomId: string; messageIds: string[] }) => {
      this.activeMessages.update((msgs) =>
        msgs.map((m) => data.messageIds.includes(m.id) ? { ...m, status: 'read' as const } : m)
      );
    });
  }

  disconnect() {
    this.socket?.disconnect();
  }

  loadRooms() {
    this.http.get<Room[]>(`${API}/rooms`).subscribe((r) => {
      this.rooms.set(r);
      // Load last message for each room
      r.forEach((room) => {
        const userId = this.auth.user()?.id;
        const since = room.isGroup && room.joinedAt && userId ? room.joinedAt[userId] : undefined;
        const params = since ? `?since=${since}` : '';
        this.http.get<Message[]>(`${API}/rooms/${room.id}/messages${params}`).subscribe((msgs) => {
          if (msgs.length > 0) {
            this.lastMessages.update((m) => new Map(m).set(room.id, msgs[msgs.length - 1]));
          }
        });
      });
    });
  }

  loadAllGroups() {
    this.http.get<Room[]>(`${API}/groups`).subscribe((g) => this.allGroups.set(g));
  }

  selectRoom(room: Room) {
    this.activeRoom.set(room);
    this.unreadCounts.update((m) => { const n = new Map(m); n.delete(room.id); return n; });
    this.pinnedMessage.set(null);

    const userId = this.auth.user()?.id;
    const isMember = !room.isGroup || (userId && room.members.includes(userId));

    if (isMember) {
      this.socket.emit('joinRoom', { roomId: room.id });
      this.socket.emit('markRead', { roomId: room.id });
      const since = room.isGroup && room.joinedAt && userId ? room.joinedAt[userId] : undefined;
      const params = since ? `?since=${since}` : '';
      this.http.get<Message[]>(`${API}/rooms/${room.id}/messages${params}`).subscribe((m) => {
        this.activeMessages.set(m);
        if (m.length > 0) {
          this.lastMessages.update((lm) => new Map(lm).set(room.id, m[m.length - 1]));
        }
        // Load pinned message
        if (room.pinnedMessageId) {
          const pinned = m.find((msg) => msg.id === room.pinnedMessageId);
          this.pinnedMessage.set(pinned || null);
        }
      });
    } else {
      this.activeMessages.set([]);
    }
  }

  sendMessage(content: string, replyTo?: { id: string; content: string; sender: string }) {
    const room = this.activeRoom();
    if (!room) return;
    this.socket.emit('sendMessage', { roomId: room.id, content, replyTo });
    this.socket.emit('stopTyping', { roomId: room.id });
  }

  startDm(userId: string) {
    return this.http.post<Room>(`${API}/dm/${userId}`, {});
  }

  createGroup(name: string, memberIds: string[]) {
    return this.http.post<Room>(`${API}/group`, { name, memberIds });
  }

  joinGroup(roomId: string) {
    return this.http.post<Room>(`${API}/group/${roomId}/join`, {});
  }

  leaveGroup(roomId: string) {
    return this.http.post<{ success: boolean }>(`${API}/group/${roomId}/leave`, {});
  }

  emitTyping(roomId: string) {
    this.socket.emit('typing', { roomId });
  }

  emitStopTyping(roomId: string) {
    this.socket.emit('stopTyping', { roomId });
  }

  reactToMessage(messageId: string, roomId: string, emoji: string) {
    this.socket.emit('reactMessage', { messageId, roomId, emoji });
  }

  forwardMessage(messageId: string, targetRoomId: string) {
    return this.http.post<Message>(`${API}/forward`, { messageId, targetRoomId });
  }

  forwardToUser(messageId: string, userId: string) {
    return this.http.post<Message>(`${API}/forward-to-user`, { messageId, userId });
  }

  pinMessage(roomId: string, messageId: string | null) {
    return this.http.post<{ room: Room; pinnedMessage: Message | null }>(`${API}/rooms/${roomId}/pin`, { messageId });
  }

  deleteForMe(messageId: string) {
    return this.http.post<Message>(`${API}/messages/${messageId}/delete-for-me`, {});
  }

  deleteForEveryone(messageId: string) {
    return this.http.post<Message>(`${API}/messages/${messageId}/delete-for-everyone`, {});
  }

  uploadFile(roomId: string, file: File, caption?: string) {
    const formData = new FormData();
    formData.append('file', file);
    if (caption) formData.append('caption', caption);
    return this.http.post<Message>(`${API}/upload/${roomId}`, formData);
  }
}
