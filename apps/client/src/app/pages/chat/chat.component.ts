import { Component, OnInit, OnDestroy, signal, computed, ViewChild, ElementRef, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ChatService, Room, Message } from '../../services/chat.service';
import { ToastService } from '../../services/toast.service';

@Component({
    selector: 'app-chat',
    imports: [FormsModule, CommonModule, DatePipe],
    template: `
    <div class="chat-layout">
      <aside class="sidebar" [class.mobile-hidden]="showMobileChat()">
        <div class="sidebar-header">
          <div class="header-user" (click)="goToSettings()" style="cursor:pointer">
            <div class="avatar avatar-sm">
              @if (auth.user()?.avatarUrl) {
                <img [src]="auth.user()!.avatarUrl" class="avatar-img" />
              } @else {
                {{ auth.user()?.username?.charAt(0)?.toUpperCase() }}
              }
            </div>
            <span class="header-username">{{ auth.user()?.username }}</span>
          </div>
          <div class="header-actions">
            <button class="btn-sm" (click)="toggleTheme()">{{ auth.isDark() ? '☀️' : '🌙' }}</button>
            <button class="btn-sm" (click)="goToSettings()">⚙️</button>
            <button class="btn-sm" (click)="onLogout()">Logout</button>
          </div>
        </div>

        <!-- Search / Actions -->
        <div class="sidebar-actions">
          <button class="btn-action" [class.active]="activeTab() === 'chats'" (click)="activeTab.set('chats')">Chats</button>
          <button class="btn-action" [class.active]="activeTab() === 'users'" (click)="activeTab.set('users'); refreshUsers()">Users</button>
          <button class="btn-action groups-btn" [class.active]="activeTab() === 'groups'" (click)="openGroups()">
            Groups @if (chat.newGroupAvailable()) { <span class="new-badge">NEW</span> }
          </button>
        </div>
        <div class="search-bar">
          <input [value]="searchQuery()" (input)="searchQuery.set($any($event.target).value)" placeholder="Search chats, users..." />
        </div>

        <!-- TAB: Chats -->
        @if (activeTab() === 'chats') {
          <div class="tab-header">
            <span>Recent Chats</span>
            <button class="btn-new-group" (click)="showNewGroup.set(!showNewGroup())">+ Group</button>
          </div>
          @if (showNewGroup()) {
            <div class="panel">
              <input [(ngModel)]="groupName" placeholder="Group name" (keyup.enter)="createGroup()" />
              <button class="btn-action" (click)="createGroup()">Create</button>
            </div>
          }
          <div class="room-list">
            @if (chat.roomsLoading()) {
              <div class="messages-loader">
                <div class="chat-spinner"></div>
                <span>Loading chats...</span>
              </div>
            }
            @for (room of filteredRooms(); track room.id) {
              <div class="room-item" [class.active]="chat.activeRoom()?.id === room.id" [class.has-unread]="getUnreadCount(room.id) > 0" (click)="onRoomSelect(room)">
                <div class="room-avatar" [class.online]="!room.isGroup && isUserOnline(room)">
                  <div class="avatar">
                    @if (getRoomAvatar(room)) {
                      <img [src]="getRoomAvatar(room)" class="avatar-img" />
                    } @else {
                      {{ getRoomInitial(room) }}
                    }
                  </div>
                  @if (!room.isGroup && isUserOnline(room)) { <span class="status-dot"></span> }
                </div>
                <div class="room-details">
                  <div class="room-top">
                    <span class="room-name">{{ getRoomName(room) }}</span>
                    @if (getLastMessage(room.id)) {
                      <span class="room-time">{{ getLastMessage(room.id)!.timestamp | date:'shortTime' }}</span>
                    }
                  </div>
                  <div class="room-bottom">
                    @if (getRoomTypingText(room.id)) {
                      <span class="room-preview typing-text">{{ getRoomTypingText(room.id) }}</span>
                    } @else {
                      <span class="room-preview">
                        @if (room.isGroup) { <span class="preview-icon">👥</span> }
                        {{ getLastMessagePreview(room.id) }}
                      </span>
                    }
                    @if (getUnreadCount(room.id) > 0) {
                      <span class="unread-badge">{{ getUnreadCount(room.id) }}</span>
                    }
                  </div>
                </div>
              </div>
            } @empty {
              <div class="empty-text">No conversations yet</div>
            }
          </div>
        }

        <!-- TAB: Users -->
        @if (activeTab() === 'users') {
          <div class="tab-header"><span>All Users</span></div>
          <div class="room-list">
            @for (u of filteredUsers(); track u.id) {
              <div class="room-item" (click)="startDm(u.id)">
                <div class="room-avatar" [class.online]="chat.onlineUserIds().has(u.id)">
                  <div class="avatar">
                    @if (u.avatarUrl) {
                      <img [src]="u.avatarUrl" class="avatar-img" />
                    } @else {
                      {{ u.username.charAt(0).toUpperCase() }}
                    }
                  </div>
                  @if (chat.onlineUserIds().has(u.id)) { <span class="status-dot"></span> }
                </div>
                <div class="room-details">
                  <div class="room-top">
                    <span class="room-name">{{ u.username }}</span>
                  </div>
                  <div class="room-bottom">
                    <span class="room-preview user-status" [class.online]="chat.onlineUserIds().has(u.id)">
                      {{ chat.onlineUserIds().has(u.id) ? 'online' : 'offline' }}
                    </span>
                  </div>
                </div>
              </div>
            } @empty {
              <div class="empty-text">No other users</div>
            }
          </div>
        }

        <!-- TAB: Groups -->
        @if (activeTab() === 'groups') {
          <div class="tab-header"><span>Available Groups</span></div>
          <div class="room-list">
            @for (group of filteredGroups(); track group.id) {
              <div class="room-item" (click)="onGroupClick(group)">
                <div class="room-avatar">
                  <div class="avatar group-avatar">👥</div>
                </div>
                <div class="room-details">
                  <div class="room-top">
                    <span class="room-name">{{ group.name }}</span>
                    <span class="room-time">{{ group.members.length }} members</span>
                  </div>
                  <div class="room-bottom">
                    @if (isJoined(group)) {
                      <span class="room-preview user-status online">Joined</span>
                    } @else {
                      <button class="btn-join" (click)="$event.stopPropagation(); joinGroup(group.id)">Join</button>
                    }
                  </div>
                </div>
              </div>
            } @empty {
              <div class="empty-text">No groups available</div>
            }
          </div>
        }

        @if (pendingJoinGroup()) {
          <div class="panel join-prompt">
            <div class="join-prompt-text">Join <strong>{{ pendingJoinGroup()!.name }}</strong>?</div>
            <div class="join-prompt-actions">
              <button class="btn-join" (click)="confirmJoin()">Join</button>
              <button class="btn-action" (click)="pendingJoinGroup.set(null)">Cancel</button>
            </div>
          </div>
        }
      </aside>

      <!-- Chat Area -->
      <main class="chat-area" [class.mobile-visible]="showMobileChat()">
        @if (forwardingMsg()) {
          <div class="forward-overlay" (click)="forwardingMsg.set(null)">
            <div class="forward-modal" (click)="$event.stopPropagation()">
              <div class="forward-header">
                <span>Forward to...</span>
                <button class="file-remove" (click)="forwardingMsg.set(null)">✕</button>
              </div>
              <div class="forward-tabs">
                <button [class.active]="forwardTab() === 'chats'" (click)="forwardTab.set('chats')">Chats</button>
                <button [class.active]="forwardTab() === 'users'" (click)="forwardTab.set('users')">Users</button>
              </div>
              <div class="forward-list">
                @if (forwardTab() === 'chats') {
                  @for (room of chat.rooms(); track room.id) {
                    <div class="room-item" (click)="confirmForward(room.id)">
                      <div class="avatar">
                        @if (getRoomAvatar(room)) {
                          <img [src]="getRoomAvatar(room)" class="avatar-img" />
                        } @else {
                          {{ getRoomInitial(room) }}
                        }
                      </div>
                      <div class="forward-item-info">
                        <span class="room-name">{{ getRoomName(room) }}</span>
                        @if (room.isGroup) { <span class="forward-item-sub">👥 Group</span> }
                      </div>
                    </div>
                  } @empty {
                    <div class="forward-empty">No chats yet</div>
                  }
                }
                @if (forwardTab() === 'users') {
                  @for (u of otherUsers(); track u.id) {
                    <div class="room-item" (click)="confirmForwardToUser(u.id)">
                      <div class="avatar">
                        @if (u.avatarUrl) {
                          <img [src]="u.avatarUrl" class="avatar-img" />
                        } @else {
                          {{ u.username.charAt(0).toUpperCase() }}
                        }
                      </div>
                      <div class="forward-item-info">
                        <span class="room-name">{{ u.username }}</span>
                        <span class="forward-item-sub" [class.online]="chat.onlineUserIds().has(u.id)">{{ chat.onlineUserIds().has(u.id) ? 'online' : 'offline' }}</span>
                      </div>
                    </div>
                  } @empty {
                    <div class="forward-empty">No users</div>
                  }
                }
              </div>
            </div>
          </div>
        }
        @if (chat.activeRoom()) {
          @if (deletingMsg()) {
            <div class="forward-overlay" (click)="deletingMsg.set(null)">
              <div class="delete-dialog" (click)="$event.stopPropagation()">
                <div class="delete-dialog-title">Delete message?</div>
                <div class="delete-dialog-preview">“{{ deletingMsg()!.content.length > 50 ? deletingMsg()!.content.substring(0, 50) + '...' : deletingMsg()!.content }}”</div>
                <div class="delete-dialog-actions">
                  @if (deletingMsg()!.senderId === auth.user()?.id) {
                    <button class="delete-btn everyone" (click)="confirmDeleteForEveryone()">Delete for everyone</button>
                  }
                  <button class="delete-btn forme" (click)="confirmDeleteForMe()">Delete for me</button>
                  <button class="delete-btn cancel" (click)="deletingMsg.set(null)">Cancel</button>
                </div>
              </div>
            </div>
          }
          <div class="chat-header">
            <button class="btn-back" (click)="backToList()">←</button>
            <div class="avatar avatar-header">
              @if (getRoomAvatar(chat.activeRoom()!)) {
                <img [src]="getRoomAvatar(chat.activeRoom()!)" class="avatar-img" />
              } @else {
                {{ getRoomInitial(chat.activeRoom()!) }}
              }
            </div>
            <div class="header-info">
              <div class="header-name">{{ getRoomName(chat.activeRoom()!) }}</div>
              @if (typingText()) {
                <div class="header-sub typing-text">{{ typingText() }}</div>
              } @else if (chat.activeRoom()!.isGroup) {
                <div class="header-sub">{{ chat.activeRoom()!.members.length }} members</div>
              } @else {
                <div class="header-sub" [class.online]="isUserOnline(chat.activeRoom()!)">
                  {{ isUserOnline(chat.activeRoom()!) ? 'online' : 'offline' }}
                </div>
              }
            </div>
            @if (chat.activeRoom()!.isGroup && isActiveRoomJoined()) {
              <button class="btn-exit" (click)="exitGroup()">Exit Group</button>
            }
          </div>

          @if (isActiveRoomJoined()) {
            @if (chat.pinnedMessage()) {
              <div class="pinned-bar" (click)="scrollToMessage(chat.pinnedMessage()!.id)">
                <span class="pinned-icon">📌</span>
                <div class="pinned-content">
                  <span class="pinned-label">Pinned Message</span>
                  <span class="pinned-text">{{ chat.pinnedMessage()!.content }}</span>
                </div>
                <button class="pinned-unpin" (click)="$event.stopPropagation(); unpinMsg()">✕</button>
              </div>
            }
            <div class="messages" #messagesContainer>
              @if (chat.messagesLoading()) {
                <div class="messages-loader">
                  <div class="chat-spinner"></div>
                  <span>Loading messages...</span>
                </div>
              }
              <div class="messages-inner">
              @for (msg of chat.activeMessages(); track msg.id) {
                @if (msg.isSystem) {
                  <div class="system-msg"><span>{{ msg.content }}</span></div>
                } @else if (msg.deletedFor?.includes(auth.user()?.id || '')) {
                } @else if (msg.deletedForEveryone) {
                  <div class="msg-row" [class.own]="msg.senderId === auth.user()?.id">
                    <div class="msg-wrapper">
                      <div class="bubble deleted-bubble" [class.own]="msg.senderId === auth.user()?.id">
                        <span class="deleted-text">🚫 This message was deleted</span>
                      </div>
                    </div>
                  </div>
                } @else {
                  <div class="msg-row" [attr.id]="'msg-' + msg.id" [class.own]="msg.senderId === auth.user()?.id" [class.highlighted]="highlightedMsgId() === msg.id">
                    <div class="msg-wrapper">
                      <div class="msg-actions-top" [class.own]="msg.senderId === auth.user()?.id">
                        <button class="msg-action-btn" (click)="toggleReactionPicker(msg.id)" title="React">😊</button>
                        <button class="msg-action-btn" (click)="openForwardPicker(msg)" title="Forward">↪️</button>
                        <button class="msg-action-btn" (click)="setReply(msg)" title="Reply">↩️</button>
                        <button class="msg-action-btn" (click)="pinMsg(msg)" title="Pin">📌</button>
                        <button class="msg-action-btn" (click)="openDeleteDialog(msg)" title="Delete">🗑️</button>
                      </div>
                      <div class="bubble" [class.own]="msg.senderId === auth.user()?.id">
                        @if (msg.senderId !== auth.user()?.id && chat.activeRoom()!.isGroup) {
                          <div class="msg-sender">{{ msg.senderName }}</div>
                        }
                        @if (msg.forwarded) {
                          <div class="msg-forwarded">Forwarded from {{ msg.forwardedFrom }}</div>
                        }
                        @if (msg.replyToId) {
                          <div class="reply-preview-bubble" (click)="$event.stopPropagation(); scrollToMessage(msg.replyToId!)">
                            <span class="reply-sender">{{ msg.replyToSender }}</span>
                            <span class="reply-text">{{ msg.replyToContent }}</span>
                          </div>
                        }
                        <div class="msg-body">
                          @if (msg.fileUrl) {
                            @if (msg.fileType?.startsWith('image/')) {
                              <img class="msg-image" [src]="msg.fileUrl" [alt]="msg.fileName" (click)="openFile(msg.fileUrl!)" />
                            } @else {
                              <a class="msg-file" [href]="msg.fileUrl" target="_blank">
                                <span class="msg-file-icon">📄</span>
                                <span class="msg-file-name">{{ msg.fileName }}</span>
                              </a>
                            }
                          }
                          @if (!msg.fileUrl || msg.content !== '📷 Photo') {
                            <span class="msg-content" [innerHTML]="formatMessage(msg.content)"></span>
                          }
                          <span class="msg-meta">
                            <span class="msg-time">{{ msg.timestamp | date:'shortTime' }}</span>
                            @if (msg.senderId === auth.user()?.id) {
                              <span class="msg-tick" [class.delivered]="msg.status === 'delivered'" [class.read]="msg.status === 'read'">
                                @if (msg.status === 'sent') { ✓ }
                                @if (msg.status === 'delivered') { ✓✓ }
                                @if (msg.status === 'read') { ✓✓ }
                                @if (!msg.status) { ✓ }
                              </span>
                            }
                          </span>
                        </div>
                      </div>
                      @if (hasReactions(msg)) {
                        <div class="reactions-bar" [class.own]="msg.senderId === auth.user()?.id">
                          @for (r of getReactionEntries(msg); track r.emoji) {
                            <span class="reaction-chip" [class.reacted]="r.userIds.includes(auth.user()?.id || '')" (click)="react(msg, r.emoji)">
                              {{ r.emoji }} {{ r.userIds.length }}
                            </span>
                          }
                        </div>
                      }
                      @if (reactionPickerMsgId() === msg.id) {
                        <div class="reaction-picker" [class.own]="msg.senderId === auth.user()?.id">
                          @for (e of quickReactions; track e) {
                            <span class="reaction-option" (click)="react(msg, e)">{{ e }}</span>
                          }
                        </div>
                      }
                    </div>
                  </div>
                }
              }
              </div>
            </div>

            @if (typingText()) {
              <div class="typing-indicator">{{ typingText() }}</div>
            }

            <div class="input-area">
              @if (replyingTo()) {
                <div class="reply-bar">
                  <div class="reply-bar-content">
                    <span class="reply-bar-sender">{{ replyingTo()!.senderName }}</span>
                    <span class="reply-bar-text">{{ replyingTo()!.content.length > 60 ? replyingTo()!.content.substring(0, 60) + '...' : replyingTo()!.content }}</span>
                  </div>
                  <button class="reply-bar-close" (click)="replyingTo.set(null)">✕</button>
                </div>
              }
              <div class="input-row">
                <button class="btn-emoji" (click)="showEmojiPicker.set(!showEmojiPicker())">😊</button>
                <button class="btn-emoji" (click)="fileInput.click()">📎</button>
                <input #fileInput type="file" hidden (change)="onFileSelected($event)" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt" />
                <textarea #msgInput [(ngModel)]="messageText" placeholder="Type a message..." (keydown)="onKeyDown($event)" (input)="onTyping()" rows="1"></textarea>
                <button (click)="send()">Send</button>
              </div>
              @if (filePreview()) {
                <div class="file-preview">
                  @if (filePreview()!.isImage) {
                    <img [src]="filePreview()!.dataUrl" alt="preview" />
                  } @else {
                    <span class="file-icon">📄</span>
                  }
                  <div class="file-info">
                    <span class="file-name">{{ filePreview()!.name }}</span>
                    <span class="file-size">{{ formatFileSize(filePreview()!.size) }}</span>
                  </div>
                  <button class="file-remove" (click)="clearFile()">✕</button>
                </div>
              }
              @if (showEmojiPicker()) {
                <div class="emoji-picker">
                  <div class="emoji-tabs">
                    @for (cat of emojiCategories; track cat.name) {
                      <button [class.active]="activeEmojiTab() === cat.name" (click)="activeEmojiTab.set(cat.name)">{{ cat.icon }}</button>
                    }
                  </div>
                  <div class="emoji-grid">
                    @for (emoji of getActiveEmojis(); track emoji) {
                      <span class="emoji-item" (click)="insertEmoji(emoji)">{{ emoji }}</span>
                    }
                  </div>
                </div>
              }
            </div>
          } @else {
            <div class="join-required">
              <div class="join-required-icon">🔒</div>
              <div class="join-required-title">Join "{{ chat.activeRoom()!.name }}" to start chatting</div>
              <div class="join-required-subtitle">You need to join this group to see messages and participate</div>
              <button class="btn-join-large" (click)="joinGroup(chat.activeRoom()!.id)">Join Group</button>
            </div>
          }
        } @else {
          <div class="no-chat">
            <div style="font-size:3rem">💬</div>
            <div>Select a chat or start a new conversation</div>
          </div>
        }
      </main>
    </div>
  `,
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

  emojiCategories = [
    { name: 'smileys', icon: '😊', emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','😮‍💨','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'] },
    { name: 'gestures', icon: '👋', emojis: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅','👄'] },
    { name: 'hearts', icon: '❤️', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','💋','💌','💐','🌹','🥀','💍','💎'] },
    { name: 'animals', icon: '🐶', emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪰','🪲','🪳','🦟','🦗','🕷️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊'] },
    { name: 'food', icon: '🍕', emojis: ['🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🫒','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🫕','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🥛','🍼','🫖','☕','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾','🧊'] },
    { name: 'travel', icon: '✈️', emojis: ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍️','🛵','🚲','🛴','🛹','🛼','🚁','✈️','🛩️','🚀','🛸','🚢','⛵','🚤','🛥️','🛳️','⛴️','🚂','🚃','🚄','🚅','🚆','🚇','🚈','🚉','🚊','🚝','🚞','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🛕','🕍','⛩️','🕋'] },
    { name: 'objects', icon: '⚽', emojis: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🥍','🏑','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌','🎿','⛷️','🏂','🪂','🏋️','🎯','🎮','🕹️','🎲','🧩','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺','🪗','🎸','🪕','🎻','🎪','💻','📱','📞','📷','📹','🔔','🔑','🗝️','💡','📚','✏️','🖊️'] },
  ];

  quickReactions = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

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
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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

  private fmtBold = /\*(.*?)\*/g;
  private fmtItalic = /_(.*?)_/g;
  private fmtStrike = /~(.*?)~/g;
  private fmtCode = /`(.*?)`/g;

  formatMessage(content: string): string {
    let html = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    html = html.replace(this.fmtBold, '<strong>$1</strong>');
    html = html.replace(this.fmtItalic, '<em>$1</em>');
    html = html.replace(this.fmtStrike, '<del>$1</del>');
    html = html.replace(this.fmtCode, '<code>$1</code>');
    html = html.replace(/\n/g, '<br>');
    return html;
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

  constructor(public auth: AuthService, public chat: ChatService, private router: Router, private toast: ToastService) {
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
