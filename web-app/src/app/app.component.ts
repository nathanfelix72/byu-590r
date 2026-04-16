import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthStore } from './core/stores/auth.store';
import { UserStore } from './core/stores/user.store';
import { UserService } from './core/services/user.service';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RealtimeService } from './core/services/realtime.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterModule,
    RouterOutlet,
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDialogModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  private authStore = inject(AuthStore);
  protected userStore = inject(UserStore);
  private userService = inject(UserService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private realtime = inject(RealtimeService);

  theme = signal<'light' | 'dark'>('light');
  profileDialog = signal(false);
  profileIsUploading = signal(false);

  profile = signal({
    name: '',
    avatar: '',
    icon: 'mdi-account-circle',
    color: 'info',
  });

  private hasLoadedUser = signal(false);

  shouldLoadUser = computed(() => {
    const isAuthenticated = this.authStore.isAuthenticated();
    const user = this.authStore.user();
    const hasLoaded = this.hasLoadedUser();
    return isAuthenticated && user && !hasLoaded;
  });

  ngOnInit(): void {
    if (this.shouldLoadUser()) {
      this.hasLoadedUser.set(true);
      this.getCurrentUser();
    }
  }

  get isAuthenticated() {
    return this.authStore.isAuthenticated();
  }

  get user() {
    return this.authStore.user();
  }

  get avatarURL() {
    return this.authStore.avatar();
  }

  get title() {
    const userName = this.authStore.userName();
    return userName ? `Welcome ${userName}!` : 'Welcome!';
  }

  isGameSessionsRoute(): boolean {
    return this.router.url.startsWith('/game-sessions');
  }

  changeTheme(): void {
    this.theme.set(this.theme() === 'light' ? 'dark' : 'light');
  }

  logout(): void {
    this.hasLoadedUser.set(false);
    this.realtime.disconnect();
    this.authStore.logout();
    this.router.navigate(['/login']);
  }

  getCurrentUser(): void {
    const user = this.user;
    if (!user) return;

    this.profile.set({
      ...this.profile(),
      name: user.name || '',
    });

    this.userService.getUser().subscribe({
      next: (response) => {
        if (response.results.avatar) {
          this.authStore.updateAvatar(response.results.avatar);
        }
        this.userStore.setUser(response.results);
      },
      error: () => {
        this.logout();
      },
    });
  }

  onAvatarChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    this.profileIsUploading.set(true);
    this.userService.uploadAvatar(input.files[0]).subscribe({
      next: (response) => {
        this.authStore.updateAvatar(response.results.avatar);
        this.profileIsUploading.set(false);
      },
      error: () => {
        this.snackBar.open('Error. Try again', 'Close', {
          duration: 5000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: ['error-snackbar'],
        });
        this.profileIsUploading.set(false);
      },
    });
  }

  removeAvatar(): void {
    this.profileIsUploading.set(true);
    this.userService.removeAvatar().subscribe({
      next: (response) => {
        this.authStore.updateAvatar(null);
        this.profileIsUploading.set(false);
      },
      error: () => {
        this.snackBar.open('Error. Try again', 'Close', {
          duration: 5000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: ['error-snackbar'],
        });
        this.profileIsUploading.set(false);
      },
    });
  }

  openProfileDialog(): void {
    // Will be handled by template
    this.profileDialog.set(true);
  }
}
