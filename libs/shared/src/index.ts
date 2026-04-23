export interface User {
  id: string;
  username: string;
  password?: string;
  avatarUrl?: string;
  theme?: string;
}

export interface AuthPayload {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: Omit<User, 'password'>;
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

export interface Room {
  id: string;
  name: string;
  isGroup: boolean;
  members: string[];
  createdBy?: string;
  joinedAt?: Record<string, number>;
  pinnedMessageId?: string;
}

export interface CreateGroupDto {
  name: string;
  memberIds: string[];
}

// Socket events
export enum SocketEvents {
  SendMessage = 'sendMessage',
  NewMessage = 'newMessage',
  JoinRoom = 'joinRoom',
  LeaveRoom = 'leaveRoom',
  UserOnline = 'userOnline',
  UserOffline = 'userOffline',
  Typing = 'typing',
  StopTyping = 'stopTyping',
  RoomCreated = 'roomCreated',
  UserJoined = 'userJoined',
  UserLeft = 'userLeft',
  ReactMessage = 'reactMessage',
  MessageReacted = 'messageReacted',
  ForwardMessage = 'forwardMessage',
  PinMessage = 'pinMessage',
  MessagePinned = 'messagePinned',
  MessageDeleted = 'messageDeleted',
  MessagesDelivered = 'messagesDelivered',
  MessagesRead = 'messagesRead',
}
