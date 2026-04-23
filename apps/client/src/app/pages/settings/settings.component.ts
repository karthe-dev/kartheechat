import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
    selector: 'app-settings',
    imports: [FormsModule],
    template: `
    <div class="settings-page">
      <div class="settings-card">
        <button class="back-btn" (click)="router.navigate(['/chat'])">← Back to Chat</button>
        <h2>Account Settings</h2>

        <!-- Avatar Section -->
        <div class="section">
          <h3>Profile Photo</h3>
          <div class="avatar-section">
            <div class="avatar-preview" (click)="avatarInput.click()">
              @if (auth.user()?.avatarUrl) {
                <img [src]="auth.user()!.avatarUrl" alt="avatar" />
              } @else {
                <span class="avatar-letter">{{ auth.user()?.username?.charAt(0)?.toUpperCase() }}</span>
              }
              <div class="avatar-overlay">📷</div>
            </div>
            <input #avatarInput type="file" hidden accept="image/*" (change)="onAvatarSelected($event)" />
            <div class="avatar-info">
              <span class="avatar-name">{{ auth.user()?.username }}</span>
              <span class="avatar-hint">Click photo to change (max 2MB)</span>
            </div>
          </div>
          @if (avatarMsg()) {
            <div class="msg" [class.error]="avatarMsg()!.startsWith('Error')">{{ avatarMsg() }}</div>
          }
        </div>

        <!-- Password Section -->
        <div class="section">
          <h3>Change Password</h3>
          <form (ngSubmit)="changePassword()">
            <input [(ngModel)]="oldPassword" name="old" type="password" placeholder="Current password" required />
            <input [(ngModel)]="newPassword" name="new" type="password" placeholder="New password" required />
            <input [(ngModel)]="confirmPassword" name="confirm" type="password" placeholder="Confirm new password" required />
            <button type="submit" [disabled]="!oldPassword || !newPassword || newPassword !== confirmPassword">Update Password</button>
          </form>
          @if (pwMsg()) {
            <div class="msg" [class.error]="pwMsg()!.startsWith('Error')">{{ pwMsg() }}</div>
          }
        </div>
      </div>
    </div>
  `,
    styles: [`
    .settings-page {
      min-height: 100vh; background: linear-gradient(180deg, #008069 0%, #008069 25%, #f0f2f5 25%);
      display: flex; justify-content: center; padding: 2rem 1rem;
    }
    :host-context(body.dark-theme) .settings-page { background: linear-gradient(180deg, #1f2c34 0%, #1f2c34 25%, #0b141a 25%); }
    .settings-card {
      background: #fff; border-radius: 12px; padding: 2rem; width: 440px; max-width: 92vw;
      box-shadow: 0 2px 12px rgba(0,0,0,0.1); height: fit-content;
    }
    :host-context(body.dark-theme) .settings-card { background: #1f2c34; color: #e9edef; }
    :host-context(body.dark-theme) input { background: #111b21; border-color: #2a3942; color: #e9edef; }
    :host-context(body.dark-theme) input:focus { border-color: #00a884; background: #1f2c34; }
    :host-context(body.dark-theme) h3 { color: #00a884; }
    :host-context(body.dark-theme) .avatar-hint { color: #8696a0; }
    :host-context(body.dark-theme) .avatar-name { color: #e9edef; }
    .back-btn {
      background: none; border: none; color: #008069; cursor: pointer;
      font-size: 0.85rem; padding: 0; margin-bottom: 1rem; font-weight: 500;
      &:hover { text-decoration: underline; }
    }
    h2 { margin: 0 0 1.5rem; color: #111b21; font-size: 1.3rem; }
    .section { margin-bottom: 2rem; }
    h3 { margin: 0 0 0.75rem; color: #008069; font-size: 0.95rem; }

    .avatar-section { display: flex; align-items: center; gap: 1rem; }
    .avatar-preview {
      width: 80px; height: 80px; border-radius: 50%; background: #00a884;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; position: relative; overflow: hidden; flex-shrink: 0;
      img { width: 100%; height: 100%; object-fit: cover; }
      .avatar-letter { color: #fff; font-size: 2rem; font-weight: 700; }
      .avatar-overlay {
        position: absolute; inset: 0; background: rgba(0,0,0,0.4);
        display: flex; align-items: center; justify-content: center;
        font-size: 1.5rem; opacity: 0; transition: opacity 0.2s;
      }
      &:hover .avatar-overlay { opacity: 1; }
    }
    .avatar-info { display: flex; flex-direction: column; }
    .avatar-name { font-weight: 600; font-size: 1rem; color: #111b21; }
    .avatar-hint { font-size: 0.78rem; color: #667781; margin-top: 2px; }

    input {
      width: 100%; padding: 0.7rem; margin-bottom: 0.75rem;
      border: 1px solid #d1d7db; border-radius: 8px; background: #f0f2f5;
      color: #111b21; font-size: 0.9rem; outline: none; box-sizing: border-box;
      &:focus { border-color: #008069; background: #fff; }
      &::placeholder { color: #8696a0; }
    }
    button[type="submit"] {
      width: 100%; padding: 0.7rem; background: #008069; color: #fff;
      border: none; border-radius: 8px; cursor: pointer; font-size: 0.95rem; font-weight: 600;
      &:hover { background: #006b57; }
      &:disabled { background: #d1d7db; cursor: not-allowed; }
    }
    .msg {
      margin-top: 0.5rem; padding: 0.5rem; border-radius: 6px;
      font-size: 0.82rem; text-align: center;
      background: #e7f8f2; color: #008069;
      &.error { background: #fce4e4; color: #d32f2f; }
    }
  `]
})
export class SettingsComponent {
  oldPassword = '';
  newPassword = '';
  confirmPassword = '';
  avatarMsg = signal<string | null>(null);
  pwMsg = signal<string | null>(null);

  constructor(public auth: AuthService, public router: Router, private toast: ToastService) {}

  onAvatarSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { this.avatarMsg.set('Error: File exceeds 2MB'); return; }
    if (!file.type.startsWith('image/')) { this.avatarMsg.set('Error: Only images allowed'); return; }
    this.avatarMsg.set('Uploading...');
    this.auth.uploadAvatar(file).subscribe({
      next: () => { this.avatarMsg.set('Avatar updated!'); this.toast.success('Avatar updated!'); },
      error: (e) => { const m = e.error?.message || 'Upload failed'; this.avatarMsg.set('Error: ' + m); this.toast.error(m); },
    });
  }

  changePassword() {
    if (this.newPassword !== this.confirmPassword) { this.pwMsg.set('Error: Passwords do not match'); return; }
    if (this.newPassword.length < 4) { this.pwMsg.set('Error: Password must be at least 4 characters'); return; }
    this.pwMsg.set(null);
    this.auth.resetPassword(this.oldPassword, this.newPassword).subscribe({
      next: () => { this.pwMsg.set('Password updated!'); this.toast.success('Password updated!'); this.oldPassword = ''; this.newPassword = ''; this.confirmPassword = ''; },
      error: (e) => { const m = e.error?.message || 'Failed'; this.pwMsg.set('Error: ' + m); this.toast.error(m); },
    });
  }
}
