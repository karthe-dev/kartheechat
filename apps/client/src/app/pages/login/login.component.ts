import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
    selector: 'app-login',
    imports: [FormsModule],
    template: `
    <div class="auth-container">
      <div class="auth-card">
        <img src="banner.jpg" alt="KartheeChat" class="auth-banner" />
        <p class="auth-subtitle">{{ isRegister() ? 'Sign up to start chatting' : 'Login to continue' }}</p>
        @if (error()) { <div class="error">{{ error() }}</div> }
        <form (ngSubmit)="submit()">
          <input [(ngModel)]="username" name="username" placeholder="Username" required />
          <input [(ngModel)]="password" name="password" type="password" placeholder="Password" required />
          <button type="submit" [disabled]="loading()">
            @if (loading()) {
              <span class="spinner"></span>
            } @else {
              {{ isRegister() ? 'Register' : 'Login' }}
            }
          </button>
        </form>
        <p class="toggle" (click)="isRegister.set(!isRegister())">
          {{ isRegister() ? 'Already have an account? Login' : "Don't have an account? Register" }}
        </p>
      </div>
      <p class="dev-credit"><span class="heart">❤️</span> Developed by Karthick Ekambaram</p>
    </div>
  `,
    styles: [`
    .auth-container { display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; height: 100dvh; background: linear-gradient(160deg, #c8e6e0 0%, #d4eaf7 40%, #e8f0f5 100%); }
    :host-context(body.dark-theme) .auth-container { background: linear-gradient(160deg, #0b141a 0%, #111b21 40%, #1a2730 100%); }
    .auth-card { background: rgba(255,255,255,0.85); backdrop-filter: blur(10px); padding: 0 0 2rem; border-radius: 16px; width: 400px; max-width: 92vw; color: #111b21; box-shadow: 0 4px 24px rgba(0,0,0,0.08); overflow: hidden; }
    :host-context(body.dark-theme) .auth-card { background: rgba(31,44,52,0.9); color: #e9edef; box-shadow: 0 4px 24px rgba(0,0,0,0.3); }
    .auth-banner { width: 100%; display: block; border-radius: 16px 16px 0 0; }
    .auth-subtitle { text-align: center; color: #667781; font-size: 0.85rem; margin: 1rem 0 1.25rem; padding: 0 2rem; }
    input { width: 100%; padding: 0.75rem; margin-bottom: 1rem; border: 1px solid #d1d7db; border-radius: 8px; background: #f0f2f5; color: #111b21; box-sizing: border-box; font-size: 0.95rem; outline: none; }
    form { padding: 0 2rem; }
    input:focus { border-color: #008069; background: #fff; }
    input::placeholder { color: #8696a0; }
    button { width: 100%; padding: 0.75rem; background: #008069; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 0.5rem; min-height: 46px; }
    button:hover { background: #006b57; }
    button:disabled { background: #66b8a8; cursor: not-allowed; }
    .spinner { width: 20px; height: 20px; border: 2.5px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .toggle { text-align: center; color: #008069; cursor: pointer; margin-top: 1rem; font-size: 0.85rem; padding: 0 2rem; }
    .toggle:hover { text-decoration: underline; }
    .error { background: #fce4e4; color: #d32f2f; padding: 0.5rem; border-radius: 6px; margin-bottom: 1rem; text-align: center; font-size: 0.85rem; }
    .dev-credit { position: fixed; bottom: 1rem; left: 0; right: 0; text-align: center; color: #8696a0; font-size: 0.75rem; }
    .heart { color: #e53935; }
    :host-context(body.dark-theme) .dev-credit { color: #667781; }
    :host-context(body.dark-theme) input { background: #111b21; border-color: #2a3942; color: #e9edef; }
    :host-context(body.dark-theme) input:focus { border-color: #00a884; background: #1f2c34; }
    :host-context(body.dark-theme) .auth-subtitle { color: #8696a0; }
    :host-context(body.dark-theme) .toggle { color: #00a884; }
  `]
})
export class LoginComponent {
  username = '';
  password = '';
  isRegister = signal(false);
  loading = signal(false);
  error = signal('');

  constructor(private auth: AuthService, private router: Router, private toast: ToastService) {}

  submit() {
    this.error.set('');
    this.loading.set(true);
    const obs = this.isRegister()
      ? this.auth.register(this.username, this.password)
      : this.auth.login(this.username, this.password);

    obs.subscribe({
      next: () => {
        this.loading.set(false);
        this.toast.success('Welcome, ' + this.username + '! 👋');
        this.router.navigate(['/chat']);
      },
      error: (e) => {
        this.loading.set(false);
        const msg = e.error?.message || 'Something went wrong';
        this.error.set(msg);
        this.toast.error(msg);
      },
    });
  }
}
