import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthStore } from '../core/stores/auth.store';
import { UserStore } from '../core/stores/user.store';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { GameSessionService, GameSession } from '../core/services/game-session.service';
import { UserService } from '../core/services/user.service';
import { RealtimeService } from '../core/services/realtime.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatButtonModule, MatListModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  authStore = inject(AuthStore);
  userStore = inject(UserStore);
  private gameSessionService = inject(GameSessionService);
  private userService = inject(UserService);
  private realtime = inject(RealtimeService);
  router = inject(Router);

  sessions = signal<GameSession[]>([]);
  recentSessions = computed(() => this.sessions().slice(0, 3));

  stats = computed(() => {
    const p = this.userStore.user()?.profile;
    return {
      wins: p?.wins ?? 0,
      losses: p?.losses ?? 0,
    };
  });

  constructor() {
    this.refreshUserProfile();
    this.loadRecentSessions();
  }

  private refreshUserProfile(): void {
    this.userService.getUser().subscribe({
      next: (res) => this.userStore.setUser(res.results),
      error: () => {
        // Non-fatal; dashboard can still show sessions even if profile fetch fails.
      },
    });
  }

  loadRecentSessions(): void {
    this.gameSessionService.getMyGameSessions().subscribe({
      next: (res) => this.sessions.set(res.results || []),
      error: () => this.sessions.set([]),
    });
  }

  logout(): void {
    this.realtime.disconnect();
    this.authStore.logout();
    this.router.navigate(['/login']);
  }
}
