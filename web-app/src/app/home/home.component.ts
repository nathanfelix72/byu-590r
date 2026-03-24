import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthStore } from '../core/stores/auth.store';
import { UserStore } from '../core/stores/user.store';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { GameSessionService, GameSession } from '../core/services/game-session.service';
import { UserService } from '../core/services/user.service';
import { RealtimeService } from '../core/services/realtime.service';

type SortKey = 'name' | 'status' | 'score' | 'players';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  authStore = inject(AuthStore);
  userStore = inject(UserStore);
  private gameSessionService = inject(GameSessionService);
  private userService = inject(UserService);
  private realtime = inject(RealtimeService);
  router = inject(Router);

  sessions = signal<GameSession[]>([]);
  search = signal('');
  sortKey = signal<SortKey>('name');
  sortDir = signal<1 | -1>(1);

  filteredGames = computed(() => {
    let list = [...this.sessions()];
    const q = this.search().trim().toLowerCase();
    if (q) {
      list = list.filter((s) => this.sessionMatchesQuery(s, q));
    }
    const key = this.sortKey();
    const dir = this.sortDir();
    list.sort((a, b) => dir * this.compareSessions(a, b, key));
    return list;
  });

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

  onSearchInput(ev: Event): void {
    const v = (ev.target as HTMLInputElement)?.value ?? '';
    this.search.set(v);
  }

  setSortKey(key: SortKey): void {
    this.sortKey.set(key);
  }

  toggleSortDir(): void {
    this.sortDir.update((d) => (d === 1 ? -1 : 1));
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

  activePlayers(s: GameSession) {
    return (s.players || []).filter((p) => !p.left_at);
  }

  playerLine(s: GameSession): string {
    return this.activePlayers(s)
      .map((p) => p.user?.name || `Player ${p.user_id}`)
      .join(', ');
  }

  myScore(s: GameSession): number {
    const uid = this.userStore.user()?.id;
    if (uid === undefined || uid === null) return 0;
    const row = this.activePlayers(s).find((p) => Number(p.user_id) === Number(uid));
    return row?.score ?? 0;
  }

  private sessionMatchesQuery(s: GameSession, q: string): boolean {
    const bucket = [
      s.name,
      s.status,
      this.playerLine(s),
      String(this.myScore(s)),
    ]
      .join(' ')
      .toLowerCase();
    return bucket.includes(q);
  }

  private compareSessions(a: GameSession, b: GameSession, key: SortKey): number {
    switch (key) {
      case 'status':
        return String(a.status).localeCompare(String(b.status));
      case 'score':
        return this.myScore(a) - this.myScore(b);
      case 'players':
        return this.playerLine(a).localeCompare(this.playerLine(b));
      case 'name':
      default:
        return String(a.name).localeCompare(String(b.name));
    }
  }

  logout(): void {
    this.realtime.disconnect();
    this.authStore.logout();
    this.router.navigate(['/login']);
  }
}
