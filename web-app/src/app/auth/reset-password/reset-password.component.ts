import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  status = signal<'loading' | 'form' | 'success' | 'error'>('loading');
  message = signal('');
  token = signal<string | null>(null);
  form: FormGroup;
  submitLoading = signal(false);

  constructor() {
    this.form = this.fb.group(
      {
        password: ['', [Validators.required, Validators.minLength(8)]],
        password_confirmation: ['', [Validators.required]],
      },
      { validators: this.passwordMatchValidator }
    );
  }

  passwordMatchValidator(form: FormGroup): { [key: string]: boolean } | null {
    const password = form.get('password')?.value;
    const confirm = form.get('password_confirmation')?.value;
    if (password && confirm && password !== confirm) {
      return { passwordMismatch: true };
    }
    return null;
  }

  ngOnInit(): void {
    const t = this.route.snapshot.queryParamMap.get('remember_token');
    if (!t) {
      this.status.set('error');
      this.message.set('Invalid or missing reset link. Please request a new password reset.');
      return;
    }
    this.token.set(t);
    this.authService.validateResetToken(t).subscribe({
      next: () => {
        this.message.set('');
        this.status.set('form');
      },
      error: (err) => {
        this.status.set('error');
        this.message.set(
          err?.error?.message || 'This link may have expired. Please request a new password reset.'
        );
      },
    });
  }

  submit(): void {
    if (!this.form.valid || this.submitLoading()) return;
    const t = this.token();
    if (!t) return;
    this.submitLoading.set(true);
    this.authService
      .setNewPassword(t, this.form.get('password')?.value, this.form.get('password_confirmation')?.value)
      .subscribe({
        next: (res) => {
          this.submitLoading.set(false);
          this.status.set('success');
          this.message.set(res.message || 'Password updated. You can now sign in.');
          setTimeout(() => this.router.navigate(['/login']), 3000);
        },
        error: (err) => {
          this.submitLoading.set(false);
          this.message.set(err?.error?.message || 'Something went wrong. Please try again.');
        },
      });
  }
}
