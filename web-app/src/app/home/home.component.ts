import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthStore } from '../core/stores/auth.store';
import { UserStore } from '../core/stores/user.store';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { GameSessionService, GameSession } from '../core/services/game-session.service';
import { UserService } from '../core/services/user.service';
import { RealtimeService } from '../core/services/realtime.service';

type SortKey = 'name' | 'status' | 'players';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
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
    const user = this.userStore.user();
    const uid = user?.id;
    const sessions = this.sessions();

    if (uid === undefined || uid === null) {
      const p = user?.profile;
      return {
        wins: p?.wins ?? 0,
        losses: p?.losses ?? 0,
      };
    }

    let wins = 0;
    let losses = 0;

    for (const s of sessions) {
      if (s.status !== 'finished') continue;
      const winnerId = this.getWinnerUserId(s);
      if (winnerId === null) continue;
      if (!this.didUserParticipate(s, uid)) continue;

      if (winnerId === Number(uid)) {
        wins += 1;
      } else {
        losses += 1;
      }
    }

    // Prefer computed values from sessions; if none are available yet, use profile fallback.
    if (wins === 0 && losses === 0) {
      const p = user?.profile;
      return {
        wins: p?.wins ?? 0,
        losses: p?.losses ?? 0,
      };
    }

    return {
      wins,
      losses,
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

  formatStatus(status: string): string {
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  getWinner(s: GameSession): string {
    const winnerId = this.getWinnerUserId(s);
    if (winnerId === null) {
      return '';
    }
    const winner = this.activePlayers(s).find((p) => Number(p.user_id) === Number(winnerId));
    return winner?.user?.name || winner?.user_id ? `Winner: ${winner.user?.name || 'Player ' + winner.user_id}` : '';
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

  private getWinnerUserId(s: GameSession): number | null {
    if (s.status !== 'finished' || !s.state) {
      return null;
    }

    try {
      const state = typeof s.state === 'string' ? JSON.parse(s.state) : s.state;
      const winnerId = state?.winnerUserId;
      if (winnerId === null || winnerId === undefined) {
        return null;
      }
      return Number(winnerId);
    } catch {
      return null;
    }
  }

  private didUserParticipate(s: GameSession, uid: number): boolean {
    return (s.players || []).some((p) => Number(p.user_id) === Number(uid));
  }

  private sessionMatchesQuery(s: GameSession, q: string): boolean {
    const bucket = [
      s.name,
      s.status,
      this.playerLine(s),
    ]
      .join(' ')
      .toLowerCase();
    return bucket.includes(q);
  }

  private compareSessions(a: GameSession, b: GameSession, key: SortKey): number {
    // Finished games always go to the end
    if (a.status === 'finished' && b.status !== 'finished') {
      return 1;
    }
    if (b.status === 'finished' && a.status !== 'finished') {
      return -1;
    }
    
    switch (key) {
      case 'status':
        return String(a.status).localeCompare(String(b.status));
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
