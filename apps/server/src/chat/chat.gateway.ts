import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { UserService } from '../user/user.service';
import { SocketEvents, Room, Message } from 'shared';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private onlineUsers = new Map<string, string>(); // socketId -> userId

  constructor(
    private chatService: ChatService,
    private jwtService: JwtService,
    private userService: UserService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      const payload = this.jwtService.verify(token);
      const user = await this.userService.findById(payload.sub);
      if (!user) return client.disconnect();

      client.data.user = { id: user.id, username: user.username };
      this.onlineUsers.set(client.id, user.id);

      const rooms = await this.chatService.getUserRooms(user.id);
      rooms.forEach((r) => client.join(r.id));

      this.server.emit(SocketEvents.UserOnline, { userId: user.id, username: user.username });

      // Send current online users list to the newly connected client
      const onlineIds = [...new Set(this.onlineUsers.values())];
      client.emit('onlineUsersList', onlineIds);

      // Mark undelivered messages as delivered for this user
      const roomIds = rooms.map((r) => r.id);
      await this.chatService.markDelivered(user.id, roomIds);
      // Notify senders that messages were delivered
      for (const roomId of roomIds) {
        this.server.to(roomId).emit(SocketEvents.MessagesDelivered, { roomId, userId: user.id });
      }
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.onlineUsers.get(client.id);
    this.onlineUsers.delete(client.id);
    if (userId) this.server.emit(SocketEvents.UserOffline, { userId });
  }

  @SubscribeMessage(SocketEvents.JoinRoom)
  handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string }) {
    client.join(data.roomId);
  }

  @SubscribeMessage(SocketEvents.SendMessage)
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; content: string; replyTo?: { id: string; content: string; sender: string } },
  ) {
    const user = client.data.user;
    const msg = await this.chatService.addMessage(user.id, user.username, data.roomId, data.content, false, undefined, data.replyTo);
    // Check if any other user in the room is online — if so, mark as delivered
    const roomMembers = (await this.chatService.getRoom(data.roomId))?.members || [];
    const onlineInRoom = roomMembers.some((mid) => mid !== user.id && [...this.onlineUsers.values()].includes(mid));
    if (onlineInRoom && msg.status === 'sent') {
      msg.status = 'delivered';
      await this.chatService.sb.client.from('messages').update({ status: 'delivered' }).eq('id', msg.id);
    }
    this.server.to(data.roomId).emit(SocketEvents.NewMessage, msg);
    return msg;
  }

  @SubscribeMessage(SocketEvents.Typing)
  handleTyping(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string }) {
    client.to(data.roomId).emit(SocketEvents.Typing, { userId: client.data.user.id, username: client.data.user.username, roomId: data.roomId });
  }

  @SubscribeMessage(SocketEvents.StopTyping)
  handleStopTyping(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string }) {
    client.to(data.roomId).emit(SocketEvents.StopTyping, { userId: client.data.user.id, roomId: data.roomId });
  }

  @SubscribeMessage('markRead')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const user = client.data.user;
    const updatedIds = await this.chatService.markRead(user.id, data.roomId);
    if (updatedIds.length > 0) {
      this.server.to(data.roomId).emit(SocketEvents.MessagesRead, { roomId: data.roomId, userId: user.id, messageIds: updatedIds });
    }
  }

  @SubscribeMessage(SocketEvents.ReactMessage)
  async handleReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; roomId: string; emoji: string },
  ) {
    const user = client.data.user;
    const msg = await this.chatService.reactToMessage(data.messageId, user.id, data.emoji);
    if (msg) {
      this.server.to(data.roomId).emit(SocketEvents.MessageReacted, msg);
    }
    return msg;
  }

  @SubscribeMessage(SocketEvents.ForwardMessage)
  async handleForward(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; targetRoomId: string },
  ) {
    const user = client.data.user;
    const msg = await this.chatService.forwardMessage(data.messageId, data.targetRoomId, user.id, user.username);
    if (msg) {
      this.server.to(data.targetRoomId).emit(SocketEvents.NewMessage, msg);
    }
    return msg;
  }

  notifyRoomCreated(room: Room) {
    for (const [socketId, userId] of this.onlineUsers.entries()) {
      if (room.members.includes(userId)) {
        const socket = this.server.sockets.sockets.get(socketId);
        if (socket) {
          socket.join(room.id);
          socket.emit(SocketEvents.RoomCreated, room);
        }
      }
    }
    if (room.isGroup) {
      this.server.emit('groupListUpdated', room);
    }
  }

  notifyUserJoined(room: Room, joinedUserId: string, sysMsg: Message) {
    for (const [socketId, userId] of this.onlineUsers.entries()) {
      if (userId === joinedUserId) {
        const socket = this.server.sockets.sockets.get(socketId);
        if (socket) socket.join(room.id);
      }
    }
    this.server.to(room.id).emit(SocketEvents.NewMessage, sysMsg);
    this.server.to(room.id).emit(SocketEvents.UserJoined, { room, message: sysMsg });
    this.server.emit('groupListUpdated', room);
  }

  notifyUserLeft(room: Room, leftUserId: string, sysMsg: Message) {
    this.server.to(room.id).emit(SocketEvents.NewMessage, sysMsg);
    this.server.to(room.id).emit(SocketEvents.UserLeft, { room, message: sysMsg });

    for (const [socketId, userId] of this.onlineUsers.entries()) {
      if (userId === leftUserId) {
        const socket = this.server.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit(SocketEvents.UserLeft, { room, message: sysMsg, leftUserId });
          socket.leave(room.id);
        }
      }
    }
    this.server.emit('groupListUpdated', room);
  }

  broadcastMessage(roomId: string, msg: Message) {
    this.server.to(roomId).emit(SocketEvents.NewMessage, msg);
  }

  broadcastPin(roomId: string, room: Room, pinnedMessage: Message | null) {
    this.server.to(roomId).emit(SocketEvents.MessagePinned, { room, pinnedMessage });
  }

  broadcastDeleteForEveryone(roomId: string, msg: Message) {
    this.server.to(roomId).emit(SocketEvents.MessageDeleted, msg);
  }
}
