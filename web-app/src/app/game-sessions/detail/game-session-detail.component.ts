import { Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatListModule } from '@angular/material/list';
import { GameSessionService, GameSession } from '../../core/services/game-session.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { UserStore } from '../../core/stores/user.store';

@Component({
  selector: 'app-game-session-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatSnackBarModule,
    MatListModule,
  ],
  templateUrl: './game-session-detail.component.html',
  styleUrl: './game-session-detail.component.scss',
})
export class GameSessionDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private service = inject(GameSessionService);
  private snackBar = inject(MatSnackBar);
  private realtime = inject(RealtimeService);
  protected userStore = inject(UserStore);

  session = signal<GameSession | null>(null);
  isLoading = signal(false);

  sessionId = computed(() => Number(this.route.snapshot.paramMap.get('id')));

  ngOnInit(): void {
    this.refresh();
    this.attachRealtime();
  }

  ngOnDestroy(): void {
    this.realtime.leave(`game-session.${this.sessionId()}`);
  }

  attachRealtime(): void {
    const echo = this.realtime.connect();
    if (!echo) return;

    const channelName = `game-session.${this.sessionId()}`;
    echo
      .private(channelName)
      .listen('.GameSessionUpdated', (payload: any) => {
        if (payload?.gameSessionId) this.refresh();
      });
  }

  refresh(): void {
    this.isLoading.set(true);
    this.service.getGameSession(this.sessionId()).subscribe({
      next: (res) => {
        this.session.set(res.results);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Failed to load session', 'Close', {
          duration: 5000,
        });
        this.isLoading.set(false);
      },
    });
  }

  get myUserId(): number | null {
    return this.userStore.user()?.id ?? null;
  }

  get unoState(): any | null {
    const s = this.session();
    return (s as any)?.state ?? null;
  }

  get currentTurnUserId(): number | null {
    const state = this.unoState;
    if (!state?.players || typeof state.currentTurn !== 'number') return null;
    return state.players?.[state.currentTurn]?.user_id ?? null;
  }

  get currentTurnName(): string {
    const uid = this.currentTurnUserId;
    if (!uid) return '—';
    return this.nameForUserId(uid);
  }

  get isMyTurn(): boolean {
    const uid = this.myUserId;
    const turnUid = this.currentTurnUserId;
    return !!uid && !!turnUid && uid === turnUid;
  }

  nameForUserId(userId: number): string {
    const list = this.playersList();
    const row = list.find((p: any) => Number(p.user_id) === Number(userId));
    const name = row?.user?.name;
    return name ? String(name) : `Player ${userId}`;
  }

  myHand(): any[] {
    const uid = this.myUserId;
    const state = this.unoState;
    if (!uid || !state?.players) return [];
    const me = state.players.find((p: any) => p.user_id === uid);
    return me?.hand ?? [];
  }

  playersList(): any[] {
    const s: any = this.session();
    return Array.isArray(s?.players) ? s.players : [];
  }

  playCard(cardIndex: number): void {
    if (!this.isMyTurn) return;
    const s = this.session();
    if (!s) return;
    const clientVersion = (s.version ?? 0) as number;
    this.service
      .makeMove(s.id, {
        type: 'play_card',
        payload: { cardIndex, chosenColor: 'r' },
        clientVersion,
      })
      .subscribe({
        next: (res) => this.session.set(res.results),
        error: (err) => {
          this.snackBar.open(err?.error?.data?.error || err?.error?.message || 'Move failed', 'Close', {
            duration: 5000,
          });
        },
      });
  }

  draw(): void {
    if (!this.isMyTurn) return;
    const s = this.session();
    if (!s) return;
    const clientVersion = (s.version ?? 0) as number;
    this.service
      .makeMove(s.id, { type: 'draw', payload: {}, clientVersion })
      .subscribe({
        next: (res) => this.session.set(res.results),
        error: (err) => {
          this.snackBar.open(err?.error?.data?.error || err?.error?.message || 'Draw failed', 'Close', {
            duration: 5000,
          });
        },
      });
  }

  toggleReady(): void {
    const s = this.session();
    if (!s) return;
    // We don’t know your user_id on the client in this MVP; we just “flip” by calling ready true/false.
    // Default behavior: set ready true (you can extend this later by rendering your pivot record).
    this.service.setReady(s.id, true).subscribe({
      next: () => {
        this.snackBar.open('Ready set', 'Close', { duration: 2500 });
        this.refresh();
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Failed to set ready', 'Close', {
          duration: 5000,
        });
      },
    });
  }

  start(): void {
    const s = this.session();
    if (!s) return;
    this.service.startGameSession(s.id).subscribe({
      next: () => {
        this.snackBar.open('Game started', 'Close', { duration: 2500 });
        this.refresh();
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Failed to start', 'Close', {
          duration: 5000,
        });
      },
    });
  }

  leave(): void {
    const s = this.session();
    if (!s) return;
    this.service.leaveGameSession(s.id).subscribe({
      next: () => {
        this.snackBar.open('Left session', 'Close', { duration: 2500 });
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Failed to leave', 'Close', {
          duration: 5000,
        });
      },
    });
  }
}

