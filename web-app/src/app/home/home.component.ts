import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthStore } from '../core/stores/auth.store';
import { UserStore } from '../core/stores/user.store';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { GameSessionService, GameSession } from '../core/services/game-session.service';
import { GamesService, Game, GameTag } from '../core/services/games.service';
import { UserService } from '../core/services/user.service';
import { RealtimeService } from '../core/services/realtime.service';
import { ConfirmDialogComponent } from '../shared/confirm-dialog/confirm-dialog.component';
import { EditSessionDialogComponent } from '../game-sessions/edit-session-dialog/edit-session-dialog.component';

type SortKey = 'name' | 'status' | 'players';

export type OpponentStatRow = {
  userId: number;
  name: string;
  gamesTogether: number;
  yourWins: number;
  theirWins: number;
};

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
    MatDialogModule,
    MatSnackBarModule,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  authStore = inject(AuthStore);
  userStore = inject(UserStore);
  private gameSessionService = inject(GameSessionService);
  private gamesService = inject(GamesService);
  private userService = inject(UserService);
  private realtime = inject(RealtimeService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  router = inject(Router);

  sessions = signal<GameSession[]>([]);
  games = signal<Game[]>([]);
  tags = signal<GameTag[]>([]);
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

  gamesPlayed = computed(() => {
    const user = this.userStore.user();
    const uid = user?.id;
    if (uid === undefined || uid === null) {
      return 0;
    }
    return this.sessions().filter((s) => s.status === 'finished' && this.didUserParticipate(s, uid)).length;
  });

  uniqueOpponents = computed(() => this.opponentLeaderboard().length);

  opponentLeaderboard = computed((): OpponentStatRow[] => {
    const uid = this.userStore.user()?.id;
    if (uid === undefined || uid === null) {
      return [];
    }
    const map = new Map<number, OpponentStatRow>();

    for (const s of this.sessions()) {
      if (s.status !== 'finished' || !this.didUserParticipate(s, uid)) {
        continue;
      }
      const winnerId = this.getWinnerUserId(s);
      const others = (s.players || []).filter(
        (p) => !p.left_at && Number(p.user_id) !== Number(uid)
      );
      for (const p of others) {
        const oid = Number(p.user_id);
        const name = p.user?.name || `Player ${oid}`;
        if (!map.has(oid)) {
          map.set(oid, {
            userId: oid,
            name,
            gamesTogether: 0,
            yourWins: 0,
            theirWins: 0,
          });
        }
        const row = map.get(oid)!;
        row.gamesTogether += 1;
        if (row.name.startsWith('Player ') && name && !name.startsWith('Player ')) {
          row.name = name;
        }
        if (winnerId !== null) {
          if (Number(winnerId) === Number(uid)) {
            row.yourWins += 1;
          } else if (Number(winnerId) === oid) {
            row.theirWins += 1;
          }
        }
      }
    }

    return [...map.values()].sort((a, b) => b.gamesTogether - a.gamesTogether);
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
    this.loadGamesAndTags();
  }

  private loadGamesAndTags(): void {
    this.gamesService.getGames().subscribe({
      next: (res) => this.games.set(res.results || []),
      error: () => this.games.set([]),
    });
    this.gamesService.getTags().subscribe({
      next: (res) => this.tags.set(res.results || []),
      error: () => this.tags.set([]),
    });
  }

  isHost(session: GameSession): boolean {
    const uid = this.authStore.user()?.id;
    return uid != null && Number(session.host_user_id) === Number(uid);
  }

  openEdit(session: GameSession): void {
    this.dialog
      .open(EditSessionDialogComponent, {
        width: 'min(100vw - 32px, 480px)',
        data: {
          session,
          games: this.games(),
          tags: this.tags(),
        },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.snackBar.open('Session updated', 'Close', { duration: 3000 });
          this.loadRecentSessions();
        }
      });
  }

  deleteSession(sessionId: number, sessionName: string): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Delete session',
          message: `Are you sure you want to delete "${sessionName}"? This action cannot be undone.`,
          confirmText: 'Delete',
          confirmColor: 'warn',
        },
      })
      .afterClosed()
      .subscribe((result) => {
        if (!result) {
          return;
        }
        this.gameSessionService.deleteGameSession(sessionId).subscribe({
          next: () => {
            this.snackBar.open('Session deleted', 'Close', { duration: 3000 });
            this.loadRecentSessions();
          },
          error: (err) => {
            this.snackBar.open(
              err?.error?.message || 'Failed to delete session',
              'Close',
              { duration: 5000 }
            );
          },
        });
      });
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
      s.started_at ?? '',
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
