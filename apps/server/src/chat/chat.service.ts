import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { Room, Message } from 'shared';

@Injectable()
export class ChatService {
  constructor(public sb: SupabaseService) {}

  private async buildRoom(roomRow: any): Promise<Room> {
    const { data: members } = await this.sb.client
      .from('room_members')
      .select('user_id, joined_at')
      .eq('room_id', roomRow.id)
      .eq('is_active', true);

    const memberIds = (members || []).map((m) => m.user_id);
    const joinedAt: Record<string, number> = {};
    (members || []).forEach((m) => { joinedAt[m.user_id] = new Date(m.joined_at).getTime(); });

    return {
      id: roomRow.id,
      name: roomRow.name,
      isGroup: roomRow.is_group,
      members: memberIds,
      createdBy: roomRow.created_by,
      joinedAt,
      pinnedMessageId: roomRow.pinned_message_id || undefined,
    };
  }

  private toMessage(row: any): Message {
    return {
      id: row.id,
      senderId: row.sender_id || 'system',
      senderName: row.sender_name,
      roomId: row.room_id,
      content: row.content,
      timestamp: new Date(row.created_at).getTime(),
      isSystem: row.is_system,
      reactions: row.reactions || {},
      fileUrl: row.file_url || undefined,
      fileName: row.file_name || undefined,
      fileType: row.file_type || undefined,
      forwarded: row.forwarded || false,
      forwardedFrom: row.forwarded_from || undefined,
      deletedFor: row.deleted_for || [],
      deletedForEveryone: row.deleted_for_everyone || false,
      replyToId: row.reply_to_id || undefined,
      replyToContent: row.reply_to_content || undefined,
      replyToSender: row.reply_to_sender || undefined,
      status: row.status || 'sent',
      readBy: row.read_by || [],
    };
  }

  async getOrCreateDmRoom(userId1: string, userId2: string): Promise<Room> {
    // Find existing DM room
    const { data: rooms1 } = await this.sb.client
      .from('room_members')
      .select('room_id')
      .eq('user_id', userId1)
      .eq('is_active', true);

    const { data: rooms2 } = await this.sb.client
      .from('room_members')
      .select('room_id')
      .eq('user_id', userId2)
      .eq('is_active', true);

    const ids1 = new Set((rooms1 || []).map((r) => r.room_id));
    const commonRoomIds = (rooms2 || []).filter((r) => ids1.has(r.room_id)).map((r) => r.room_id);

    if (commonRoomIds.length > 0) {
      const { data: existing } = await this.sb.client
        .from('rooms')
        .select('*')
        .in('id', commonRoomIds)
        .eq('is_group', false)
        .limit(1)
        .single();

      if (existing) return this.buildRoom(existing);
    }

    // Create new DM room
    const { data: room } = await this.sb.client
      .from('rooms')
      .insert({ name: 'dm', is_group: false })
      .select()
      .single();

    await this.sb.client.from('room_members').insert([
      { room_id: room.id, user_id: userId1 },
      { room_id: room.id, user_id: userId2 },
    ]);

    return this.buildRoom(room);
  }

  async createGroup(name: string, memberIds: string[], createdBy: string): Promise<Room> {
    const { data: room } = await this.sb.client
      .from('rooms')
      .insert({ name, is_group: true, created_by: createdBy })
      .select()
      .single();

    await this.sb.client.from('room_members').insert({ room_id: room.id, user_id: createdBy });

    return this.buildRoom(room);
  }

  async joinGroup(roomId: string, userId: string): Promise<Room | null> {
    const { data: room } = await this.sb.client
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .eq('is_group', true)
      .single();
    if (!room) return null;

    // Check if already active member
    const { data: existing } = await this.sb.client
      .from('room_members')
      .select('id, is_active')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .single();

    if (existing && existing.is_active) return this.buildRoom(room);

    if (existing) {
      // Re-activate
      await this.sb.client.from('room_members')
        .update({ is_active: true, joined_at: new Date().toISOString(), left_at: null })
        .eq('id', existing.id);
    } else {
      await this.sb.client.from('room_members').insert({ room_id: roomId, user_id: userId });
    }

    return this.buildRoom(room);
  }

  async leaveGroup(roomId: string, userId: string): Promise<Room | null> {
    const { data: room } = await this.sb.client
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .eq('is_group', true)
      .single();
    if (!room) return null;

    await this.sb.client.from('room_members')
      .update({ is_active: false, left_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', userId);

    return this.buildRoom(room);
  }

  async addMessage(senderId: string, senderName: string, roomId: string, content: string, isSystem = false, file?: { url: string; name: string; type: string }, reply?: { id: string; content: string; sender: string }): Promise<Message> {
    const { data } = await this.sb.client
      .from('messages')
      .insert({
        room_id: roomId,
        sender_id: isSystem ? null : senderId,
        sender_name: senderName,
        content,
        is_system: isSystem,
        file_url: file?.url || null,
        file_name: file?.name || null,
        file_type: file?.type || null,
        reply_to_id: reply?.id || null,
        reply_to_content: reply?.content || null,
        reply_to_sender: reply?.sender || null,
      })
      .select()
      .single();

    return this.toMessage(data);
  }

  async uploadFile(fileBuffer: Buffer, fileName: string, mimeType: string, roomId: string): Promise<string> {
    const path = `${roomId}/${Date.now()}_${fileName}`;
    const { error } = await this.sb.client.storage
      .from('KartheBucket')
      .upload(path, fileBuffer, { contentType: mimeType });
    if (error) throw error;

    const { data } = this.sb.client.storage.from('KartheBucket').getPublicUrl(path);
    return data.publicUrl;
  }

  async getMessages(roomId: string, since?: number): Promise<Message[]> {
    let query = this.sb.client
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (since) {
      query = query.gte('created_at', new Date(since).toISOString());
    }

    const { data } = await query;
    return (data || []).map((r) => this.toMessage(r));
  }

  async getUserRooms(userId: string): Promise<Room[]> {
    const { data: memberships } = await this.sb.client
      .from('room_members')
      .select('room_id')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (!memberships || memberships.length === 0) return [];

    const roomIds = memberships.map((m) => m.room_id);
    const { data: rooms } = await this.sb.client
      .from('rooms')
      .select('*')
      .in('id', roomIds);

    const result: Room[] = [];
    for (const r of rooms || []) {
      result.push(await this.buildRoom(r));
    }
    return result;
  }

  async getAllGroups(): Promise<Room[]> {
    const { data: rooms } = await this.sb.client
      .from('rooms')
      .select('*')
      .eq('is_group', true);

    const result: Room[] = [];
    for (const r of rooms || []) {
      result.push(await this.buildRoom(r));
    }
    return result;
  }

  async getRoom(roomId: string): Promise<Room | null> {
    const { data: room } = await this.sb.client
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();
    if (!room) return null;
    return this.buildRoom(room);
  }

  async reactToMessage(messageId: string, userId: string, emoji: string): Promise<Message | null> {
    const { data: msg } = await this.sb.client
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
    if (!msg) return null;

    const reactions: Record<string, string[]> = msg.reactions || {};

    if (reactions[emoji]?.includes(userId)) {
      // Remove reaction (toggle off)
      reactions[emoji] = reactions[emoji].filter((id) => id !== userId);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      // Add reaction
      if (!reactions[emoji]) reactions[emoji] = [];
      reactions[emoji].push(userId);
    }

    const { data: updated } = await this.sb.client
      .from('messages')
      .update({ reactions })
      .eq('id', messageId)
      .select()
      .single();

    return this.toMessage(updated);
  }

  async forwardMessage(messageId: string, targetRoomId: string, senderId: string, senderName: string): Promise<Message | null> {
    const { data: original } = await this.sb.client
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
    if (!original) return null;

    const { data } = await this.sb.client
      .from('messages')
      .insert({
        room_id: targetRoomId,
        sender_id: senderId,
        sender_name: senderName,
        content: original.content,
        is_system: false,
        file_url: original.file_url,
        file_name: original.file_name,
        file_type: original.file_type,
        forwarded: true,
        forwarded_from: original.sender_name,
      })
      .select()
      .single();

    return this.toMessage(data);
  }

  async pinMessage(roomId: string, messageId: string | null): Promise<Room | null> {
    const { error } = await this.sb.client
      .from('rooms')
      .update({ pinned_message_id: messageId })
      .eq('id', roomId);
    if (error) return null;
    const { data: room } = await this.sb.client.from('rooms').select('*').eq('id', roomId).single();
    if (!room) return null;
    return this.buildRoom(room);
  }

  async getMessage(messageId: string): Promise<Message | null> {
    const { data } = await this.sb.client.from('messages').select('*').eq('id', messageId).single();
    if (!data) return null;
    return this.toMessage(data);
  }

  async deleteForMe(messageId: string, userId: string): Promise<Message | null> {
    const { data: msg } = await this.sb.client.from('messages').select('*').eq('id', messageId).single();
    if (!msg) return null;
    const deletedFor: string[] = msg.deleted_for || [];
    if (!deletedFor.includes(userId)) deletedFor.push(userId);
    const { data } = await this.sb.client.from('messages').update({ deleted_for: deletedFor }).eq('id', messageId).select().single();
    return this.toMessage(data);
  }

  async deleteForEveryone(messageId: string, userId: string): Promise<Message | null> {
    const { data: msg } = await this.sb.client.from('messages').select('*').eq('id', messageId).single();
    if (!msg) return null;
    if (msg.sender_id !== userId) return null;
    const { data } = await this.sb.client.from('messages')
      .update({ deleted_for_everyone: true, content: 'This message was deleted', file_url: null, file_name: null, file_type: null })
      .eq('id', messageId).select().single();
    return this.toMessage(data);
  }

  async markDelivered(userId: string, roomIds: string[]): Promise<void> {
    if (!roomIds.length) return;
    for (const roomId of roomIds) {
      await this.sb.client
        .from('messages')
        .update({ status: 'delivered' })
        .eq('room_id', roomId)
        .eq('status', 'sent')
        .neq('sender_id', userId);
    }
  }

  async markRead(userId: string, roomId: string): Promise<string[]> {
    const { data: msgs } = await this.sb.client
      .from('messages')
      .select('id, read_by, sender_id')
      .eq('room_id', roomId)
      .neq('sender_id', userId)
      .neq('status', 'read');

    const updatedIds: string[] = [];
    for (const msg of msgs || []) {
      const readBy: string[] = msg.read_by || [];
      if (!readBy.includes(userId)) {
        readBy.push(userId);
        await this.sb.client.from('messages')
          .update({ read_by: readBy, status: 'read' })
          .eq('id', msg.id);
        updatedIds.push(msg.id);
      }
    }
    return updatedIds;
  }
}
