import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
    selector: 'app-login',
    imports: [FormsModule],
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss']
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
