import { Body, Controller, Get, Param, Post, Query, Req, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { CreateGroupDto } from 'shared';

@UseGuards(AuthGuard('jwt'))
@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService, private chatGateway: ChatGateway) {}

  @Post('dm/:userId')
  async startDm(@Req() req: any, @Param('userId') userId: string) {
    const room = await this.chatService.getOrCreateDmRoom(req.user.id, userId);
    this.chatGateway.notifyRoomCreated(room);
    return room;
  }

  @Post('group')
  async createGroup(@Req() req: any, @Body() dto: CreateGroupDto) {
    const room = await this.chatService.createGroup(dto.name, dto.memberIds, req.user.id);
    this.chatGateway.notifyRoomCreated(room);
    return room;
  }

  @Post('group/:roomId/join')
  async joinGroup(@Req() req: any, @Param('roomId') roomId: string) {
    const room = await this.chatService.joinGroup(roomId, req.user.id);
    if (!room) return { error: 'Room not found' };
    const username = req.user.username;
    const sysMsg = await this.chatService.addMessage('system', 'System', roomId, `${username} joined the group`, true);
    this.chatGateway.notifyUserJoined(room, req.user.id, sysMsg);
    return room;
  }

  @Post('group/:roomId/leave')
  async leaveGroup(@Req() req: any, @Param('roomId') roomId: string) {
    const username = req.user.username;
    const sysMsg = await this.chatService.addMessage('system', 'System', roomId, `${username} left the group`, true);
    const room = await this.chatService.leaveGroup(roomId, req.user.id);
    if (!room) return { error: 'Room not found' };
    this.chatGateway.notifyUserLeft(room, req.user.id, sysMsg);
    return { success: true };
  }

  @Get('rooms')
  async getRooms(@Req() req: any) {
    return this.chatService.getUserRooms(req.user.id);
  }

  @Get('groups')
  async getAllGroups() {
    return this.chatService.getAllGroups();
  }

  @Get('rooms/:roomId/messages')
  async getMessages(@Req() req: any, @Param('roomId') roomId: string, @Query('since') since?: string) {
    const room = await this.chatService.getRoom(roomId);
    if (room?.isGroup && !room.members.includes(req.user.id)) {
      return [];
    }
    return this.chatService.getMessages(roomId, since ? Number(since) : undefined);
  }

  @Post('upload/:roomId')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@Req() req: any, @Param('roomId') roomId: string, @UploadedFile() file: any, @Body() body: any) {
    if (!file) throw new BadRequestException('No file provided');
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) throw new BadRequestException('File size exceeds 2MB limit');

    const fileUrl = await this.chatService.uploadFile(file.buffer, file.originalname, file.mimetype, roomId);
    const caption = body?.caption?.trim();
    const isImage = file.mimetype.startsWith('image/');
    const defaultContent = isImage ? 'Photo' : file.originalname;
    const content = caption || defaultContent;
    const msg = await this.chatService.addMessage(
      req.user.id, req.user.username, roomId, content, false,
      { url: fileUrl, name: file.originalname, type: file.mimetype },
    );
    this.chatGateway.broadcastMessage(roomId, msg);
    return msg;
  }

  @Post('forward')
  async forwardMessage(@Req() req: any, @Body() body: { messageId: string; targetRoomId: string }) {
    const msg = await this.chatService.forwardMessage(body.messageId, body.targetRoomId, req.user.id, req.user.username);
    if (!msg) throw new BadRequestException('Message not found');
    this.chatGateway.broadcastMessage(body.targetRoomId, msg);
    return msg;
  }

  @Post('forward-to-user')
  async forwardToUser(@Req() req: any, @Body() body: { messageId: string; userId: string }) {
    const room = await this.chatService.getOrCreateDmRoom(req.user.id, body.userId);
    this.chatGateway.notifyRoomCreated(room);
    const msg = await this.chatService.forwardMessage(body.messageId, room.id, req.user.id, req.user.username);
    if (!msg) throw new BadRequestException('Message not found');
    this.chatGateway.broadcastMessage(room.id, msg);
    return msg;
  }

  @Post('rooms/:roomId/pin')
  async pinMessage(@Req() req: any, @Param('roomId') roomId: string, @Body() body: { messageId: string | null }) {
    const room = await this.chatService.pinMessage(roomId, body.messageId);
    if (!room) throw new BadRequestException('Room not found');
    let pinnedMsg = null;
    if (body.messageId) {
      pinnedMsg = await this.chatService.getMessage(body.messageId);
    }
    this.chatGateway.broadcastPin(roomId, room, pinnedMsg);
    return { room, pinnedMessage: pinnedMsg };
  }

  @Post('messages/:messageId/delete-for-me')
  async deleteForMe(@Req() req: any, @Param('messageId') messageId: string) {
    const msg = await this.chatService.deleteForMe(messageId, req.user.id);
    if (!msg) throw new BadRequestException('Message not found');
    return msg;
  }

  @Post('messages/:messageId/delete-for-everyone')
  async deleteForEveryone(@Req() req: any, @Param('messageId') messageId: string) {
    const msg = await this.chatService.deleteForEveryone(messageId, req.user.id);
    if (!msg) throw new BadRequestException('Cannot delete this message');
    this.chatGateway.broadcastDeleteForEveryone(msg.roomId, msg);
    return msg;
  }
}
