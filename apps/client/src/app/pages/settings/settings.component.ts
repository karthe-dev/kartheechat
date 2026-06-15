import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
    selector: 'app-settings',
    imports: [FormsModule],
    templateUrl: './settings.component.html',
    styleUrls: ['./settings.component.scss']
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
