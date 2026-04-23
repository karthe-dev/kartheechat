import { Component } from '@angular/core';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  template: `
    <div class="toast-container">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast" [class]="toast.type" (click)="toastService.dismiss(toast.id)">
          <span class="toast-icon">
            @if (toast.type === 'success') { ✅ }
            @if (toast.type === 'error') { ❌ }
            @if (toast.type === 'info') { ℹ️ }
          </span>
          <span class="toast-msg">{{ toast.message }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      pointer-events: none;
    }
    .toast {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.25rem;
      border-radius: 10px;
      font-size: 0.9rem;
      font-weight: 500;
      color: #fff;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0,0,0,0.18);
      animation: slideIn 0.3s ease-out;
      min-width: 220px;
      max-width: 380px;
    }
    .toast.success { background: #008069; }
    .toast.error { background: #d32f2f; }
    .toast.info { background: #1976d2; }
    .toast-icon { font-size: 1.1rem; flex-shrink: 0; }
    .toast-msg { flex: 1; }
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @media (max-width: 576px) {
      .toast-container { top: 0.5rem; right: 0.5rem; left: 0.5rem; }
      .toast { min-width: auto; font-size: 0.82rem; padding: 0.6rem 1rem; }
    }
  `],
})
export class ToastComponent {
  constructor(public toastService: ToastService) {}
}
