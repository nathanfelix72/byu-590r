import {
  Component,
  HostListener,
  OnInit,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { map } from 'rxjs/operators';
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

  /** Session id from route (updates if the routed component is reused for another session). */
  readonly sessionId = signal(0);

  /** Avoid duplicate Echo listeners for the same session. */
  private realtimeBoundSessionId: number | null = null;

  constructor() {
    const initial = Number(this.route.snapshot.paramMap.get('id'));
    if (Number.isFinite(initial)) {
      this.sessionId.set(initial);
    }

    this.route.paramMap
      .pipe(
        map((pm) => Number(pm.get('id'))),
        takeUntilDestroyed()
      )
      .subscribe((nextId) => {
        if (!Number.isFinite(nextId) || nextId === this.sessionId()) return;
        this.realtime.leave(`game-session.${this.sessionId()}`);
        this.realtimeBoundSessionId = null;
        this.sessionId.set(nextId);
        this.refresh();
        this.scheduleRealtimeAttach(0);
      });
  }

  ngOnInit(): void {
    this.refresh();
    this.scheduleRealtimeAttach(0);
  }

  ngOnDestroy(): void {
    this.realtime.leave(`game-session.${this.sessionId()}`);
    this.realtimeBoundSessionId = null;
  }

  @HostListener('document:visibilitychange')
  onDocumentVisibility(): void {
    if (document.visibilityState === 'visible' && this.session()) {
      this.refresh({ silent: true });
    }
  }

  /** Retry Echo until token/socket is ready (fixes “must click Refresh” after cold load). */
  private scheduleRealtimeAttach(attempt: number): void {
    const maxAttempts = 15;
    const id = this.sessionId();
    if (!Number.isFinite(id) || id <= 0) return;

    const echo = this.realtime.connect();
    if (!echo) {
      if (attempt < maxAttempts) {
        window.setTimeout(() => this.scheduleRealtimeAttach(attempt + 1), 400);
      }
      return;
    }

    if (this.realtimeBoundSessionId === id) {
      return;
    }

    if (this.realtimeBoundSessionId !== null) {
      this.realtime.leave(`game-session.${this.realtimeBoundSessionId}`);
    }

    this.realtimeBoundSessionId = id;
    const channelName = `game-session.${id}`;

    echo
      .private(channelName)
      .listen('.GameSessionUpdated', (payload: any) => {
        const updatedId = Number(payload?.gameSessionId);
        if (Number.isFinite(updatedId) && updatedId === this.sessionId()) {
          this.refresh({ silent: true });
        }
      })
      .listen('.UnoMoveApplied', (payload: any) => {
        this.applyUnoMovePayload(payload);
      });
  }

  private handCountForUser(handCounts: Record<string, unknown>, uid: number): number | undefined {
    if (!handCounts || typeof handCounts !== 'object') return undefined;
    const raw = handCounts[uid] ?? handCounts[String(uid)];
    return typeof raw === 'number' ? raw : undefined;
  }

  private applyUnoMovePayload(payload: any): void {
    const s: any = this.session();
    if (!s) return;
    const payloadSessionId = Number(payload?.gameSessionId);
    const currentSessionId = Number(s.id);
    if (!Number.isFinite(payloadSessionId) || payloadSessionId !== currentSessionId) return;

    const nextVersion = Number(payload?.serverVersion);
    const curVersion = Number(s.version ?? 0);
    if (!Number.isFinite(nextVersion) || nextVersion <= curVersion) return;

    // Missed events: safer to full-sync than apply a partial delta.
    if (nextVersion > curVersion + 1) {
      this.refresh({ silent: true });
      return;
    }

    const state: any = s.state;
    if (!state || state.type !== 'uno') return;

    const publicState = payload?.publicState;
    const handCounts = (payload?.handCountsByUserId || {}) as Record<string, unknown>;
    const isFinished =
      publicState?.winnerUserId !== null && publicState?.winnerUserId !== undefined;

    const actorId = Number(payload?.lastMove?.user_id);
    const myId = this.myUserId;

    state.currentTurn = publicState?.currentTurn ?? state.currentTurn;
    state.currentColor = publicState?.currentColor ?? state.currentColor;
    state.currentValue = publicState?.currentValue ?? state.currentValue;
    state.direction = publicState?.direction ?? state.direction;
    state.pendingDraw = publicState?.pendingDraw ?? state.pendingDraw;
    state.winnerUserId = publicState?.winnerUserId ?? state.winnerUserId;

    if (publicState?.topCard) {
      state.discard = [publicState.topCard];
    }

    if (Array.isArray(state.players)) {
      state.players = state.players.map((p: any) => {
        const uid = Number(p.user_id);
        const hc = this.handCountForUser(handCounts, uid);
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

    // Reconcile with server after other players’ moves (or unknown actor). Skip when this
    // client was the actor — the HTTP move response already refreshed state.
    if (!Number.isFinite(actorId) || myId === null || actorId !== Number(myId)) {
      queueMicrotask(() => this.refresh({ silent: true }));
    }
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

  refresh(options?: { silent?: boolean }): void {
    const silent = options?.silent === true;
    if (!silent) {
      this.isLoading.set(true);
    }
    this.service.getGameSession(this.sessionId()).subscribe({
      next: (res) => {
        this.session.set(res.results);
        if (!silent) {
          this.isLoading.set(false);
        }
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Failed to load session', 'Close', {
          duration: 5000,
        });
        if (!silent) {
          this.isLoading.set(false);
        }
      },
    });
  }

  topDiscardCard(): any {
    const d = this.unoState?.discard;
    if (!Array.isArray(d) || d.length === 0) return null;
    return d[d.length - 1];
  }

  /** Tint wild / +4 on the discard pile to match `currentColor` after a color choice. */
  discardWildTint(): 'r' | 'g' | 'b' | 'y' | null {
    const top = this.topDiscardCard();
    if (!top || top.color !== 'w') return null;
    const c = this.unoState?.currentColor;
    if (c === 'r' || c === 'g' || c === 'b' || c === 'y') return c;
    return null;
  }

  currentColorLabel(): string {
    const c = this.unoState?.currentColor;
    const labels: Record<string, string> = {
      r: 'Red',
      g: 'Green',
      b: 'Blue',
      y: 'Yellow',
      w: 'Wild',
    };
    return labels[String(c)] ?? (c != null && c !== '' ? String(c) : '—');
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

