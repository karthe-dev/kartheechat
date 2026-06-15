import { Component, OnInit, OnDestroy, signal, computed, ViewChild, ElementRef, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '../../services/auth.service';
import { ChatService, Room, Message } from '../../services/chat.service';
import { ToastService } from '../../services/toast.service';
import { EMOJI_CATEGORIES, QUICK_REACTIONS, formatMessageContent, formatFileSize } from './utils/chat.utils';

@Component({
    selector: 'app-chat',
    imports: [FormsModule, CommonModule, DatePipe],
    templateUrl: './chat.component.html',
    styleUrls: ['./chat.component.scss']
})
export class ChatComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('msgInput') msgInput!: ElementRef;

  messageText = '';
  groupName = '';
  searchQuery = signal('');
  activeTab = signal<'chats' | 'users' | 'groups'>('chats');
  showNewGroup = signal(false);
  showMobileChat = signal(false);
  showEmojiPicker = signal(false);
  activeEmojiTab = signal('smileys');
  reactionPickerMsgId = signal<string | null>(null);
  forwardingMsg = signal<Message | null>(null);
  forwardTab = signal<'chats' | 'users'>('chats');
  msgMenuId = signal<string | null>(null);
  highlightedMsgId = signal<string | null>(null);
  deletingMsg = signal<Message | null>(null);
  replyingTo = signal<Message | null>(null);
  filePreview = signal<{ file: File; name: string; size: number; isImage: boolean; dataUrl?: string } | null>(null);
  pendingJoinGroup = signal<Room | null>(null);
  users = signal<{ id: string; username: string; avatarUrl?: string }[]>([]);
  typingText = signal('');
  private typingTimeout: any;
  private audioCtx?: AudioContext;

  emojiCategories = EMOJI_CATEGORIES;
  quickReactions = QUICK_REACTIONS;

  toggleMsgMenu(msgId: string) {
    this.msgMenuId.set(this.msgMenuId() === msgId ? null : msgId);
    this.reactionPickerMsgId.set(null);
  }

  toggleReactionPicker(msgId: string) {
    this.reactionPickerMsgId.set(this.reactionPickerMsgId() === msgId ? null : msgId);
    this.msgMenuId.set(null);
  }

  react(msg: Message, emoji: string) {
    const room = this.chat.activeRoom();
    if (!room) return;
    this.chat.reactToMessage(msg.id, room.id, emoji);
    this.reactionPickerMsgId.set(null);
  }

  openForwardPicker(msg: Message) {
    this.forwardingMsg.set(msg);
    this.forwardTab.set('chats');
    this.reactionPickerMsgId.set(null);
    this.msgMenuId.set(null);
    this.refreshUsers();
  }

  confirmForward(targetRoomId: string) {
    const msg = this.forwardingMsg();
    if (!msg) return;
    this.chat.forwardMessage(msg.id, targetRoomId).subscribe({
      next: () => {
        this.forwardingMsg.set(null);
        this.toast.success('Message forwarded!');
      },
      error: () => this.toast.error('Forward failed'),
    });
  }

  confirmForwardToUser(userId: string) {
    const msg = this.forwardingMsg();
    if (!msg) return;
    this.chat.forwardToUser(msg.id, userId).subscribe({
      next: () => {
        this.forwardingMsg.set(null);
        this.chat.loadRooms();
        this.toast.success('Message forwarded!');
      },
      error: () => this.toast.error('Forward failed'),
    });
  }

  openDeleteDialog(msg: Message) {
    this.deletingMsg.set(msg);
    this.reactionPickerMsgId.set(null);
    this.msgMenuId.set(null);
  }

  confirmDeleteForMe() {
    const msg = this.deletingMsg();
    if (!msg) return;
    this.chat.deleteForMe(msg.id).subscribe({
      next: (updated) => {
        this.chat.activeMessages.update((msgs) => msgs.map((m) => m.id === updated.id ? updated : m));
        this.deletingMsg.set(null);
        this.toast.success('Message deleted for you');
      },
      error: () => this.toast.error('Delete failed'),
    });
  }

  confirmDeleteForEveryone() {
    const msg = this.deletingMsg();
    if (!msg) return;
    this.chat.deleteForEveryone(msg.id).subscribe({
      next: () => {
        this.deletingMsg.set(null);
        this.toast.success('Message deleted for everyone');
      },
      error: () => this.toast.error('Delete failed'),
    });
  }

  pinMsg(msg: Message) {
    const room = this.chat.activeRoom();
    if (!room) return;
    this.chat.pinMessage(room.id, msg.id).subscribe({
      next: () => this.toast.success('Message pinned!'),
      error: () => this.toast.error('Pin failed'),
    });
  }

  unpinMsg() {
    const room = this.chat.activeRoom();
    if (!room) return;
    this.chat.pinMessage(room.id, null).subscribe({
      next: () => this.toast.success('Message unpinned'),
      error: () => this.toast.error('Unpin failed'),
    });
  }

  scrollToMessage(msgId: string) {
    const el = document.getElementById('msg-' + msgId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      this.highlightedMsgId.set(msgId);
      setTimeout(() => this.highlightedMsgId.set(null), 2000);
    }
  }

  hasReactions(msg: Message): boolean {
    return !!msg.reactions && Object.keys(msg.reactions).length > 0;
  }

  getReactionEntries(msg: Message): { emoji: string; userIds: string[] }[] {
    if (!msg.reactions) return [];
    return Object.entries(msg.reactions).map(([emoji, userIds]) => ({ emoji, userIds }));
  }

  getActiveEmojis(): string[] {
    return this.emojiCategories.find((c) => c.name === this.activeEmojiTab())?.emojis || [];
  }

  insertEmoji(emoji: string) {
    this.messageText += emoji;
    this.msgInput?.nativeElement?.focus();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('File size exceeds 2MB limit');
      return;
    }
    const isImage = file.type.startsWith('image/');
    if (isImage) {
      const reader = new FileReader();
      reader.onload = () => this.filePreview.set({ file, name: file.name, size: file.size, isImage, dataUrl: reader.result as string });
      reader.readAsDataURL(file);
    } else {
      this.filePreview.set({ file, name: file.name, size: file.size, isImage });
    }
  }

  clearFile() { this.filePreview.set(null); }

  sendFile() {
    const preview = this.filePreview();
    const room = this.chat.activeRoom();
    if (!preview || !room) return;
    const caption = this.messageText.trim();
    this.chat.uploadFile(room.id, preview.file, caption).subscribe({
      next: () => { this.filePreview.set(null); this.messageText = ''; },
      error: (e) => alert(e.error?.message || 'Upload failed'),
    });
  }

  formatFileSize(bytes: number): string {
    return formatFileSize(bytes);
  }

  openFile(url: string) { window.open(url, '_blank'); }

  goToSettings() { this.router.navigate(['/settings']); }

  onLogout() {
    this.chat.disconnect();
    this.auth.logout();
  }

  toggleTheme() {
    this.auth.toggleTheme().subscribe();
  }

  formatMessage(content: string): SafeHtml {
    return formatMessageContent(content, this.sanitizer);
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  getUserAvatar(userId: string): string | undefined {
    return this.users().find((u) => u.id === userId)?.avatarUrl;
  }

  getRoomAvatar(room: Room): string | undefined {
    if (room.isGroup) return undefined;
    const other = room.members.find((id) => id !== this.auth.user()?.id);
    return other ? this.getUserAvatar(other) : undefined;
  }

  availableGroups = computed(() => this.chat.allGroups());
  otherUsers = computed(() => this.users().filter((u) => u.id !== this.auth.user()?.id));

  filteredRooms = computed(() => {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.chat.rooms();
    return this.chat.rooms().filter((r) => this.getRoomName(r).toLowerCase().includes(q));
  });

  filteredUsers = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const list = this.otherUsers();
    if (!q) return list;
    return list.filter((u) => u.username.toLowerCase().includes(q));
  });

  filteredGroups = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const list = this.availableGroups();
    if (!q) return list;
    return list.filter((g) => g.name.toLowerCase().includes(q));
  });

  constructor(public auth: AuthService, public chat: ChatService, private router: Router, private toast: ToastService, private sanitizer: DomSanitizer) {
    effect(() => {
      const map = this.chat.typingUsers();
      const names = [...map.values()];
      this.typingText.set(names.length ? `${names.join(', ')} typing...` : '');
    }, { allowSignalWrites: true });
    effect(() => {
      this.chat.activeMessages();
      setTimeout(() => this.scrollToBottom(), 50);
    }, { allowSignalWrites: true });
  }

  ngOnInit() {
    this.chat.connect();
    this.chat.loadRooms();
    this.chat.loadAllGroups();
    this.auth.getUsers().subscribe((u) => this.users.set(u));
    this.chat.onIncomingMessage = (msg) => {
      if (msg.senderId !== this.auth.user()?.id && !msg.isSystem) this.playNotificationSound();
    };
  }

  ngOnDestroy() {
    this.chat.disconnect();
    this.chat.onIncomingMessage = null;
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = undefined;
    }
  }

  getRoomName(room: Room): string {
    if (room.isGroup) return room.name;
    const other = room.members.find((id) => id !== this.auth.user()?.id);
    return this.users().find((u) => u.id === other)?.username || 'Chat';
  }

  getRoomInitial(room: Room): string {
    return this.getRoomName(room).charAt(0).toUpperCase();
  }

  isUserOnline(room: Room): boolean {
    if (room.isGroup) return false;
    const other = room.members.find((id) => id !== this.auth.user()?.id);
    return other ? this.chat.onlineUserIds().has(other) : false;
  }

  getRoomTypingText(roomId: string): string {
    const roomMap = this.chat.roomTypingUsers().get(roomId);
    if (!roomMap || roomMap.size === 0) return '';
    const names = [...roomMap.values()].filter((n) => n !== this.auth.user()?.username);
    if (names.length === 0) return '';
    if (names.length === 1) return `${names[0]} is typing...`;
    return `${names.join(', ')} are typing...`;
  }

  getLastMessage(roomId: string): Message | undefined {
    return this.chat.lastMessages().get(roomId);
  }

  getLastMessagePreview(roomId: string): string {
    const msg = this.chat.lastMessages().get(roomId);
    if (!msg) return 'No messages yet';
    if (msg.isSystem) return msg.content;
    const prefix = msg.senderId === this.auth.user()?.id ? 'You: ' : '';
    return prefix + (msg.content.length > 30 ? msg.content.substring(0, 30) + '...' : msg.content);
  }

  getUnreadCount(roomId: string): number {
    return this.chat.unreadCounts().get(roomId) || 0;
  }

  isJoined(group: Room): boolean {
    return group.members.includes(this.auth.user()?.id || '');
  }

  isActiveRoomJoined(): boolean {
    const room = this.chat.activeRoom();
    if (!room) return false;
    if (!room.isGroup) return true;
    return room.members.includes(this.auth.user()?.id || '');
  }

  onRoomSelect(room: Room) {
    this.chat.selectRoom(room);
    this.showMobileChat.set(true);
  }

  backToList() {
    this.showMobileChat.set(false);
  }

  setReply(msg: Message) {
    this.replyingTo.set(msg);
    this.msgInput?.nativeElement?.focus();
  }

  send() {
    const hasText = this.messageText.trim().length > 0;
    const hasFile = !!this.filePreview();
    if (!hasText && !hasFile) return;

    if (hasFile) {
      this.sendFile();
    } else {
      const reply = this.replyingTo();
      const replyTo = reply ? { id: reply.id, content: reply.content.substring(0, 100), sender: reply.senderName } : undefined;
      this.chat.sendMessage(this.messageText, replyTo);
      this.messageText = '';
    }
    this.showEmojiPicker.set(false);
    this.replyingTo.set(null);
  }

  startDm(userId: string) {
    this.chat.startDm(userId).subscribe((room) => {
      this.chat.loadRooms();
      this.chat.selectRoom(room);
      this.activeTab.set('chats');
      this.showMobileChat.set(true);
    });
  }

  createGroup() {
    if (!this.groupName.trim()) return;
    this.chat.createGroup(this.groupName, []).subscribe((room) => {
      this.chat.loadRooms();
      this.chat.loadAllGroups();
      this.chat.selectRoom(room);
      this.showNewGroup.set(false);
      this.groupName = '';
    });
  }

  joinGroup(roomId: string) {
    this.chat.joinGroup(roomId).subscribe((room) => {
      this.chat.loadRooms();
      this.chat.loadAllGroups();
      this.chat.selectRoom(room);
      this.activeTab.set('chats');
      this.pendingJoinGroup.set(null);
      this.showMobileChat.set(true);
    });
  }

  refreshUsers() {
    this.auth.getUsers().subscribe((u) => this.users.set(u));
  }

  openGroups() {
    this.activeTab.set('groups');
    this.chat.newGroupAvailable.set(false);
    this.chat.loadAllGroups();
  }

  onGroupClick(group: Room) {
    if (this.isJoined(group)) {
      this.chat.selectRoom(group);
      this.activeTab.set('chats');
    } else {
      this.pendingJoinGroup.set(group);
    }
  }

  exitGroup() {
    const room = this.chat.activeRoom();
    if (!room) return;
    this.chat.leaveGroup(room.id).subscribe(() => {
      this.chat.loadRooms();
      this.chat.loadAllGroups();
    });
  }

  confirmJoin() {
    const group = this.pendingJoinGroup();
    if (group) this.joinGroup(group.id);
  }

  onTyping() {
    const room = this.chat.activeRoom();
    if (!room) return;
    this.chat.emitTyping(room.id);
    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => this.chat.emitStopTyping(room.id), 1500);
  }

  private playNotificationSound() {
    try {
      if (!this.audioCtx) this.audioCtx = new AudioContext();
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.frequency.setValueAtTime(880, this.audioCtx.currentTime);
      osc.frequency.setValueAtTime(660, this.audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.3);
      osc.start(this.audioCtx.currentTime);
      osc.stop(this.audioCtx.currentTime + 0.3);
    } catch {}
  }

  private scrollToBottom() {
    if (this.messagesContainer) {
      this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
    }
  }
}
