import { Injectable, signal, computed, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { environment } from '../../environments/environment';

const API = environment.apiUrl + '/api/auth';

interface UserInfo { id: string; username: string; avatarUrl?: string; theme?: string; }
interface AuthResponse { token: string; user: UserInfo; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUser = signal<UserInfo | null>(null);
  user = this.currentUser.asReadonly();
  isLoggedIn = computed(() => !!this.currentUser());
  isDark = computed(() => this.currentUser()?.theme === 'dark');

  constructor(private http: HttpClient, private router: Router) {
    const stored = localStorage.getItem('chat_user');
    if (stored) {
      this.currentUser.set(JSON.parse(stored));
    }
    effect(() => {
      const dark = this.isDark();
      document.body.classList.toggle('dark-theme', dark);
    });
  }

  get token() { return localStorage.getItem('chat_token'); }

  register(username: string, password: string) {
    return this.http.post<AuthResponse>(`${API}/register`, { username, password }).pipe(tap((r) => this.setSession(r)));
  }

  login(username: string, password: string) {
    return this.http.post<AuthResponse>(`${API}/login`, { username, password }).pipe(tap((r) => this.setSession(r)));
  }

  logout() {
    document.body.classList.remove('dark-theme');
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_user');
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  getUsers() {
    return this.http.get<UserInfo[]>(`${API}/users`);
  }

  uploadAvatar(file: File) {
    const fd = new FormData();
    fd.append('avatar', file);
    return this.http.post<{ avatarUrl: string; user: UserInfo }>(`${API}/avatar`, fd).pipe(
      tap((r) => this.updateUser({ avatarUrl: r.avatarUrl })),
    );
  }

  resetPassword(oldPassword: string, newPassword: string) {
    return this.http.post<{ success: boolean }>(`${API}/reset-password`, { oldPassword, newPassword });
  }

  toggleTheme() {
    const newTheme = this.isDark() ? 'light' : 'dark';
    this.updateUser({ theme: newTheme });
    return this.http.post<{ theme: string }>(`${API}/theme`, { theme: newTheme });
  }

  private updateUser(partial: Partial<UserInfo>) {
    const u = this.currentUser();
    if (u) {
      const updated = { ...u, ...partial };
      this.currentUser.set(updated);
      localStorage.setItem('chat_user', JSON.stringify(updated));
    }
  }

  private setSession(res: AuthResponse) {
    localStorage.setItem('chat_token', res.token);
    localStorage.setItem('chat_user', JSON.stringify(res.user));
    this.currentUser.set(res.user);
  }
}
