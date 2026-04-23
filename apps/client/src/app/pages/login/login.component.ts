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
        <div class="auth-logo">💬</div>
        <h2>Welcome to KartheeChat</h2>
        <p class="auth-subtitle">{{ isRegister() ? 'Sign up to start chatting' : 'Login to continue' }}</p>
        @if (error()) { <div class="error">{{ error() }}</div> }
        <form (ngSubmit)="submit()">
          <input [(ngModel)]="username" name="username" placeholder="Username" required />
          <input [(ngModel)]="password" name="password" type="password" placeholder="Password" required />
          <button type="submit">{{ isRegister() ? 'Register' : 'Login' }}</button>
        </form>
        <p class="toggle" (click)="isRegister.set(!isRegister())">
          {{ isRegister() ? 'Already have an account? Login' : "Don't have an account? Register" }}
        </p>
      </div>
      <p class="dev-credit"><span class="heart">❤️</span> Developed by Karthick Ekambaram</p>
    </div>
  `,
    styles: [`
    .auth-container { display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; height: 100dvh; background: linear-gradient(180deg, #008069 0%, #008069 30%, #f0f2f5 30%); }
    :host-context(body.dark-theme) .auth-container { background: linear-gradient(180deg, #1f2c34 0%, #1f2c34 30%, #0b141a 30%); }
    .auth-card { background: #fff; padding: 2.5rem 2rem; border-radius: 12px; width: 360px; max-width: 92vw; color: #111b21; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    :host-context(body.dark-theme) .auth-card { background: #1f2c34; color: #e9edef; }
    :host-context(body.dark-theme) input { background: #111b21; border-color: #2a3942; color: #e9edef; }
    :host-context(body.dark-theme) input:focus { border-color: #00a884; background: #1f2c34; }
    :host-context(body.dark-theme) .auth-subtitle { color: #8696a0; }
    :host-context(body.dark-theme) .toggle { color: #00a884; }
    .auth-logo { text-align: center; font-size: 3rem; margin-bottom: 0.5rem; }
    h2 { text-align: center; margin-bottom: 0.25rem; color: #111b21; font-size: 1.4rem; }
    .auth-subtitle { text-align: center; color: #667781; font-size: 0.85rem; margin-bottom: 1.5rem; }
    input { width: 100%; padding: 0.75rem; margin-bottom: 1rem; border: 1px solid #d1d7db; border-radius: 8px; background: #f0f2f5; color: #111b21; box-sizing: border-box; font-size: 0.95rem; outline: none; }
    input:focus { border-color: #008069; background: #fff; }
    input::placeholder { color: #8696a0; }
    button { width: 100%; padding: 0.75rem; background: #008069; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: 600; }
    button:hover { background: #006b57; }
    .toggle { text-align: center; color: #008069; cursor: pointer; margin-top: 1rem; font-size: 0.85rem; }
    .toggle:hover { text-decoration: underline; }
    .error { background: #fce4e4; color: #d32f2f; padding: 0.5rem; border-radius: 6px; margin-bottom: 1rem; text-align: center; font-size: 0.85rem; }
    .dev-credit { position: fixed; bottom: 1rem; left: 0; right: 0; text-align: center; color: #8696a0; font-size: 0.75rem; }
    .heart { color: #e53935; }
    :host-context(body.dark-theme) .dev-credit { color: #667781; }
  `]
})
export class LoginComponent {
  username = '';
  password = '';
  isRegister = signal(false);
  error = signal('');

  constructor(private auth: AuthService, private router: Router, private toast: ToastService) {}

  submit() {
    this.error.set('');
    const obs = this.isRegister()
      ? this.auth.register(this.username, this.password)
      : this.auth.login(this.username, this.password);

    obs.subscribe({
      next: () => {
        this.toast.success('Welcome, ' + this.username + '! 👋');
        this.router.navigate(['/chat']);
      },
      error: (e) => {
        const msg = e.error?.message || 'Something went wrong';
        this.error.set(msg);
        this.toast.error(msg);
      },
    });
  }
}
