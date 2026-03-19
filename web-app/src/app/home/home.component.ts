import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthStore } from '../core/stores/auth.store';
import { UserStore } from '../core/stores/user.store';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { GameSessionService, GameSession } from '../core/services/game-session.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatButtonModule, MatListModule],
  templateUrl: './home.component.html',
  styles: []
})
export class HomeComponent {
  authStore = inject(AuthStore);
  userStore = inject(UserStore);
  private gameSessionService = inject(GameSessionService);
  router = inject(Router);

  listOfBooks = [
    'Harry Potter, J.K. Rowling',
    'Mistborn, Brandon Sanderson'
  ];

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
    this.loadRecentSessions();
  }

  loadRecentSessions(): void {
    this.gameSessionService.getMyGameSessions().subscribe({
      next: (res) => this.sessions.set(res.results || []),
      error: () => this.sessions.set([]),
    });
  }

  logout(): void {
    this.authStore.logout();
    this.router.navigate(['/login']);
  }
}
