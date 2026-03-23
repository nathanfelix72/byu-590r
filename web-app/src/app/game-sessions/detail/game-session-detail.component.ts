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
import { UserService } from '../../core/services/user.service';
import { UnoCardComponent } from '../../uno/uno-card/uno-card.component';

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
    UnoCardComponent,
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
  private userService = inject(UserService);

  session = signal<GameSession | null>(null);
  isLoading = signal(false);
  private lastWinnerSeen = signal<number | null>(null);

  private opponentBacksCap = 20;

  private pendingWildCardIndex = signal<number | null>(null);

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
        const updatedId = Number(payload?.gameSessionId);
        if (Number.isFinite(updatedId) && updatedId === this.sessionId()) {
          this.refresh();
        }
      })
      .listen('.UnoMoveApplied', (payload: any) => {
        // No-refresh update path: apply public state + card counts.
        const s: any = this.session();
        if (!s) return;
        const payloadSessionId = Number(payload?.gameSessionId);
        const currentSessionId = Number(s.id);
        if (!Number.isFinite(payloadSessionId) || payloadSessionId !== currentSessionId) return;

        const nextVersion = Number(payload?.serverVersion);
        const curVersion = Number(s.version ?? 0);
        if (!Number.isFinite(nextVersion) || nextVersion <= curVersion) return;

        const state: any = s.state;
        if (!state || state.type !== 'uno') return;

        const publicState = payload?.publicState;
        const handCounts = payload?.handCountsByUserId || {};
        const isFinished = publicState?.winnerUserId !== null && publicState?.winnerUserId !== undefined;

        // Update public fields
        state.currentTurn = publicState?.currentTurn ?? state.currentTurn;
        state.currentColor = publicState?.currentColor ?? state.currentColor;
        state.currentValue = publicState?.currentValue ?? state.currentValue;
        state.direction = publicState?.direction ?? state.direction;
        state.pendingDraw = publicState?.pendingDraw ?? state.pendingDraw;
        state.winnerUserId = publicState?.winnerUserId ?? state.winnerUserId;
        // UI only needs the top discard card for rendering.
        state.discard = publicState?.topCard ? [publicState.topCard] : [];

        // Update per-player counts (don’t touch my hand)
        if (Array.isArray(state.players)) {
          state.players = state.players.map((p: any) => {
            const uid = Number(p.user_id);
            const hc = handCounts?.[uid];
            if (typeof hc === 'number') return { ...p, handCount: hc };
            return p;
          });
        }

        this.session.set({
          ...(s as any),
          status: isFinished ? 'finished' : s.status,
          version: nextVersion,
          state,
        });

        if (isFinished) {
          const winnerId = Number(publicState?.winnerUserId);
          if (Number.isFinite(winnerId) && this.lastWinnerSeen() !== winnerId) {
            this.lastWinnerSeen.set(winnerId);
            this.refreshUserProfile();
          }
        }
      });
  }

  private refreshUserProfile(): void {
    this.userService.getUser().subscribe({
      next: (res) => {
        this.userStore.setUser(res.results);
      },
      error: () => {
        // Non-fatal; the game UI should keep working even if profile refresh fails.
      },
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

  wildPickerOpen(): boolean {
    return this.pendingWildCardIndex() !== null;
  }

  opponentHandBacks(handCount: number): number[] {
    const display = Math.max(0, Math.min(handCount, this.opponentBacksCap));
    return Array.from({ length: display }, (_, i) => i);
  }

  opponentHandRemainder(handCount: number): number {
    return Math.max(0, handCount - this.opponentBacksCap);
  }

  winnerName(): string {
    const state = this.unoState;
    const winnerId = state?.winnerUserId;
    if (winnerId === null || winnerId === undefined) return 'Player';
    return this.nameForUserId(Number(winnerId));
  }

  chooseWildColor(color: 'r' | 'g' | 'b' | 'y'): void {
    const idx = this.pendingWildCardIndex();
    if (idx === null) return;

    this.pendingWildCardIndex.set(null);
    this.submitPlayCard(idx, color);
  }

  playCard(cardIndex: number): void {
    if (!this.isMyTurn) return;

    const card = this.myHand()[cardIndex];
    if (!card) return;

    // For wild cards, let the user choose the next color.
    if (card.color === 'w') {
      this.pendingWildCardIndex.set(cardIndex);
      return;
    }

    // Non-wild cards play immediately.
    this.submitPlayCard(cardIndex);
  }

  private submitPlayCard(cardIndex: number, chosenColor?: 'r' | 'g' | 'b' | 'y'): void {
    const s = this.session();
    if (!s) return;

    // Animate from the selected hand card to the discard pile.
    this.animateHandCardToDiscard(cardIndex);

    const clientVersion = (s.version ?? 0) as number;
    const payload: any = { cardIndex };
    if (chosenColor) payload.chosenColor = chosenColor;

    this.service
      .makeMove(s.id, {
        type: 'play_card',
        payload,
        clientVersion,
      })
      .subscribe({
        next: (res) => this.session.set(res.results),
        error: (err) => {
          // If this was a wild selection, reopen the picker so the player can try again.
          if (chosenColor && this.pendingWildCardIndex() === null) {
            this.pendingWildCardIndex.set(cardIndex);
          }

          this.snackBar.open(
            err?.error?.data?.error || err?.error?.message || 'Move failed',
            'Close',
            { duration: 5000 }
          );
        },
      });
  }

  private animateHandCardToDiscard(cardIndex: number): void {
    try {
      const handButton = document.querySelector(
        `[data-hand-card-index="${cardIndex}"]`
      ) as HTMLElement | null;
      if (!handButton) return;

      const handCardHost = handButton.querySelector('app-uno-card') as HTMLElement | null;
      const startEl = handCardHost ?? handButton;

      const discardHost = document.querySelector('[data-uno-discard]') as HTMLElement | null;
      if (!discardHost) return;

      const endCardHost = discardHost.querySelector('app-uno-card') as HTMLElement | null;
      if (!endCardHost) return;

      const startRect = startEl.getBoundingClientRect();
      const endRect = endCardHost.getBoundingClientRect();

      const clone = startEl.cloneNode(true) as HTMLElement;
      clone.style.position = 'fixed';
      clone.style.left = `${startRect.left}px`;
      clone.style.top = `${startRect.top}px`;
      clone.style.zIndex = '9999';
      clone.style.pointerEvents = 'none';
      clone.style.margin = '0';
      document.body.appendChild(clone);

      const dx = endRect.left - startRect.left;
      const dy = endRect.top - startRect.top;

      clone.animate(
        [
          { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) scale(0.82)`, opacity: 0 },
        ],
        { duration: 420, easing: 'ease-in-out' }
      );

      // Cleanup after animation.
      window.setTimeout(() => {
        clone.remove();
      }, 520);
    } catch {
      // Animation is best-effort; ignore failures.
    }
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

