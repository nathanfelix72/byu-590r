import { Component, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { AuthStore } from '../../core/stores/auth.store';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private authService = inject(AuthService);
  private authStore = inject(AuthStore);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);
  private sanitizer = inject(DomSanitizer);

  loginForm: FormGroup;
  registerForm: FormGroup;
  forgotPasswordForm: FormGroup;

  isLoading = signal(false);
  errorMsg = signal('');
  selectedTabIndex = 0; // 0 = Login, 1 = Forgot Password, 2 = Create Account
  submitForgotPasswordLoading = signal(false);
  registerFormIsLoading = signal(false);
  
  // Array for particle animation
  particles = Array(10).fill(0).map((_, i) => i);
  
  // Vimeo video ID from the embed URL
  vimeoVideoId = '153749651';
  
  // Cache the sanitized URL to prevent iframe reload on change detection
  vimeoEmbedUrl: SafeResourceUrl;
  
  constructor() {
    // Initialize the Vimeo embed URL once in constructor to prevent reloads
    const url = `https://player.vimeo.com/video/${this.vimeoVideoId}?autoplay=1&loop=1&muted=1&background=1&controls=0&responsive=1`;
    this.vimeoEmbedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    
    this.loginForm = this.fb.group({
      email: [
        '',
        [Validators.required, Validators.minLength(3), Validators.email],
      ],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });

    this.registerForm = this.fb.group(
      {
        name: ['', [Validators.required, Validators.minLength(3)]],
        email: [
          '',
          [Validators.required, Validators.minLength(3), Validators.email],
        ],
        password: ['', [Validators.required, Validators.minLength(8)]],
        c_password: ['', [Validators.required]],
      },
      { validators: this.passwordMatchValidator }
    );

    this.forgotPasswordForm = this.fb.group({
      email: [
        '',
        [Validators.required, Validators.minLength(3), Validators.email],
      ],
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const cPassword = form.get('c_password');
    if (password && cPassword && password.value !== cPassword.value) {
      cPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  submitLogin(): void {
    if (!this.loginForm.valid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.loginForm.controls).forEach(key => {
        this.loginForm.get(key)?.markAsTouched();
      });
      this.errorMsg.set('Please fill in all required fields correctly.');
      return;
    }

    this.errorMsg.set('');
    this.isLoading.set(true);

    this.authService.login(this.loginForm.value).subscribe({
      next: (response) => {
        if (response.results.token) {
          this.authStore.login(response.results);
          this.router.navigate(['/home']);
        }
        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorMsg.set(
          error?.error?.message || error?.message || 'Login failed'
        );
        this.isLoading.set(false);
      },
    });
  }

  submitForgotPassword(): void {
    if (!this.forgotPasswordForm.valid) {
      return;
    }

    this.submitForgotPasswordLoading.set(true);
    this.authService
      .forgotPassword(this.forgotPasswordForm.value.email)
      .subscribe({
        next: () => {
          this.snackBar.open(
            'Success! Check your email for password reset instructions.',
            'Close',
            {
              duration: 5000,
              horizontalPosition: 'center',
              verticalPosition: 'top',
            }
          );
          this.submitForgotPasswordLoading.set(false);
          // Switch back to login tab after successful submission
          this.selectedTabIndex = 0;
          this.forgotPasswordForm.reset();
        },
        error: () => {
          this.submitForgotPasswordLoading.set(false);
        },
      });
  }

  submitRegister(): void {
    if (!this.registerForm.valid) {
      return;
    }

    this.registerFormIsLoading.set(true);
    this.authService.register(this.registerForm.value).subscribe({
      next: () => {
        this.snackBar.open('Success! Registration complete.', 'Close', {
          duration: 5000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
        });
        this.registerFormIsLoading.set(false);
        // Switch to login tab after successful registration
        this.selectedTabIndex = 0;
        this.registerForm.reset();
      },
      error: () => {
        this.snackBar.open('Error! Registration failed.', 'Close', {
          duration: 5000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: ['error-snackbar'],
        });
        this.registerFormIsLoading.set(false);
      },
    });
  }
}
