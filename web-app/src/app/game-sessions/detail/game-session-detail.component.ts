import {
  Component,
  HostListener,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  ViewChild,
  ElementRef,
  AfterViewInit,
  effect,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { map } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';
import {
  GameSessionService,
  GameSession,
  GameSessionChatMessage,
} from '../../core/services/game-session.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { UserStore } from '../../core/stores/user.store';
import { UserService } from '../../core/services/user.service';
import { UnoCardComponent } from '../../uno/uno-card/uno-card.component';
import { UnoBoardBackgroundComponent } from '../../uno/uno-board-background/uno-board-background.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-game-session-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
    UnoCardComponent,
    UnoBoardBackgroundComponent,
  ],
  templateUrl: './game-session-detail.component.html',
  styleUrl: './game-session-detail.component.scss',
})
export class GameSessionDetailComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('myHandContainer') myHandContainer?: ElementRef;
  @ViewChild('chatLog') private chatLogRef?: ElementRef<HTMLElement>;
  
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(GameSessionService);
  private snackBar = inject(MatSnackBar);
  private realtime = inject(RealtimeService);
  protected userStore = inject(UserStore);
  private userService = inject(UserService);
  private dialog = inject(MatDialog);

  session = signal<GameSession | null>(null);
  chatMessages = signal<GameSessionChatMessage[]>([]);
  /** Synced with server (PATCH chat-mute) and mirrored in localStorage for first paint. */
  protected chatMuted = signal(false);
  private lastUnoPenaltyHandledKey: string | null = null;
  /** When muted, hide all messages on screen (history returns when unmuted). */
  protected visibleChatMessages = computed(() =>
    this.chatMuted() ? [] : this.chatMessages()
  );
  chatDraft = '';
  isLoading = signal(false);
  unoBackgroundImage = signal<string | null>(null);
  private lastWinnerSeen = signal<number | null>(null);
  containerWidth = signal(typeof window !== 'undefined' ? window.innerWidth : 800);

  /** Hidden after you play/draw; resets when it’s not your turn so the next your-turn shows again. */
  private yourTurnBannerDismissed = signal(false);

  private opponentBacksCap = 20;

  private myHandResizeObserver: ResizeObserver | null = null;
  private measureContainerRaf: number | null = null;

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
        this.lastUnoPenaltyHandledKey = null;
        this.loadChatMutePreference();
        this.refresh();
        this.scheduleRealtimeAttach(0);
      });

    effect(() => {
      this.session();
      const uid = this.myUserId;
      const turn = this.currentTurnUserId;
      if (uid === null || turn !== uid) {
        this.yourTurnBannerDismissed.set(false);
      }
    });

    effect(() => {
      this.session();
      this.scheduleMeasureContainerWidth();
    });

    effect(() => {
      this.chatMuted();
      this.chatMessages().length;
      queueMicrotask(() => {
        if (this.chatMuted()) {
          return;
        }
        this.scrollChatToBottom();
      });
    });

    effect(() => {
      if (this.session()?.status === 'finished') {
        this.pendingWildCardIndex.set(null);
      }
    });
  }

  ngOnInit(): void {
    this.loadChatMutePreference();
    this.refresh();
    this.scheduleRealtimeAttach(0);
  }

  ngAfterViewInit(): void {
    this.scheduleMeasureContainerWidth();
    const el = this.myHandContainer?.nativeElement;
    if (el && typeof ResizeObserver !== 'undefined') {
      this.myHandResizeObserver = new ResizeObserver(() => {
        this.scheduleMeasureContainerWidth();
      });
      this.myHandResizeObserver.observe(el);
    }
  }

  ngOnDestroy(): void {
    this.myHandResizeObserver?.disconnect();
    this.myHandResizeObserver = null;
    if (this.measureContainerRaf != null) {
      cancelAnimationFrame(this.measureContainerRaf);
      this.measureContainerRaf = null;
    }
    this.realtime.leave(`game-session.${this.sessionId()}`);
    this.realtimeBoundSessionId = null;
  }

  private getHandContainerWidth(): number {
    if (this.myHandContainer?.nativeElement) {
      return this.myHandContainer.nativeElement.offsetWidth;
    }
    return 800; // fallback
  }

  private updateContainerWidth(): void {
    const w = this.getHandContainerWidth();
    if (w > 0) {
      this.containerWidth.set(w);
    }
  }

  /** Session updates, turns, layout: always measure after the latest scheduled frame. */
  private scheduleMeasureContainerWidth(): void {
    if (this.measureContainerRaf != null) {
      cancelAnimationFrame(this.measureContainerRaf);
    }
    this.measureContainerRaf = requestAnimationFrame(() => {
      this.measureContainerRaf = null;
      this.updateContainerWidth();
    });
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.scheduleMeasureContainerWidth();
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
      })
      .listen('.GameSessionChatMessage', (payload: any) => {
        const updatedId = Number(payload?.gameSessionId);
        if (!Number.isFinite(updatedId) || updatedId !== this.sessionId()) return;
        const msg = payload?.message as GameSessionChatMessage | undefined;
        if (!msg || typeof msg.id !== 'number') return;
        this.upsertChatMessage(msg);
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
        this.applyChatMuteFromServerSession(res.results);
        this.maybeNotifyUnoPenalty(res.results);
        const nextBg = res.results?.game_session_background_picture ?? null;
        if (nextBg !== this.unoBackgroundImage()) {
          this.unoBackgroundImage.set(nextBg);
        }
        
        const st = res.results?.status;
        if (st && st !== 'waiting') {
          this.loadChat();
        } else {
          this.chatMessages.set([]);
        }
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

  private loadChat(): void {
    const id = this.sessionId();
    if (!Number.isFinite(id) || id <= 0) return;
    this.service.getChat(id).subscribe({
      next: (res) => this.chatMessages.set(res.results || []),
      error: () => {
        // Non-fatal; table may not exist until migrate.
      },
    });
  }

  private chatMuteStorageKey(sessionId: number): string {
    return `gameSessionChatMuted:${sessionId}`;
  }

  loadChatMutePreference(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    const id = this.sessionId();
    if (!Number.isFinite(id) || id <= 0) {
      return;
    }
    this.chatMuted.set(localStorage.getItem(this.chatMuteStorageKey(id)) === '1');
  }

  private applyChatMuteFromServerSession(sess: GameSession | null): void {
    const me = this.myUserId;
    if (sess == null || me === null || !sess.players?.length) {
      return;
    }
    const row = sess.players.find((p) => p.user_id === me);
    if (row && typeof row.chat_muted === 'boolean') {
      this.chatMuted.set(row.chat_muted);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.chatMuteStorageKey(sess.id), row.chat_muted ? '1' : '0');
      }
    }
  }

  private maybeNotifyUnoPenalty(sess: GameSession): void {
    const uid = this.myUserId;
    if (uid === null) {
      return;
    }
    const history = (sess as { state?: { moveHistory?: unknown[] } })?.state?.moveHistory;
    if (!Array.isArray(history) || history.length === 0) {
      return;
    }
    const last = history[history.length - 1] as { type?: string; user_id?: number; ts?: string; drawn?: number };
    if (last?.type !== 'uno_penalty' || Number(last?.user_id) !== Number(uid)) {
      return;
    }
    const key = `${last.ts ?? ''}|${last.drawn ?? ''}`;
    if (key && key === this.lastUnoPenaltyHandledKey) {
      return;
    }
    this.lastUnoPenaltyHandledKey = key;

    const data: ConfirmDialogData = {
      title: 'UNO',
      message: 'You didn\'t say "uno" in time.',
      confirmText: 'OK',
      hideCancel: true,
    };
    this.dialog.open(ConfirmDialogComponent, { width: '360px', data });
  }

  private scrollChatToBottom(): void {
    const el = this.chatLogRef?.nativeElement;
    if (!el) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }

  toggleChatMute(): void {
    const next = !this.chatMuted();
    const id = this.sessionId();
    if (!Number.isFinite(id) || id <= 0) {
      return;
    }
    this.service.updateChatMute(id, next).subscribe({
      next: (res) => {
        this.chatMuted.set(next);
        this.session.set(res.results);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(this.chatMuteStorageKey(id), next ? '1' : '0');
        }
      },
      error: (err) => {
        this.snackBar.open(
          err?.error?.data?.error || err?.error?.message || 'Could not update chat preference',
          'Close',
          { duration: 5000 }
        );
      },
    });
  }

  private upsertChatMessage(msg: GameSessionChatMessage): void {
    const list = [...this.chatMessages()];
    const i = list.findIndex((m) => m.id === msg.id);
    if (i >= 0) list[i] = msg;
    else list.push(msg);
    list.sort((a, b) => a.id - b.id);
    this.chatMessages.set(list);
  }

  sendChat(): void {
    if (!this.canSendChat) {
      return;
    }
    const id = this.sessionId();
    const body = this.chatDraft.trim();
    if (!Number.isFinite(id) || id <= 0 || !body) return;
    this.service.postChat(id, body).subscribe({
      next: (res) => {
        this.chatDraft = '';
        this.upsertChatMessage(res.results);
      },
      error: (err) => {
        this.snackBar.open(
          err?.error?.data?.error || err?.error?.message || 'Could not send message',
          'Close',
          { duration: 5000 }
        );
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

  get isMyTurn(): boolean {
    if (this.session()?.status !== 'in_progress') {
      return false;
    }
    const uid = this.myUserId;
    const turnUid = this.currentTurnUserId;
    return !!uid && !!turnUid && uid === turnUid;
  }

  get gameIsFinished(): boolean {
    return this.session()?.status === 'finished';
  }

  /** When false, composer is disabled (muted locally or game ended). */
  get canSendChat(): boolean {
    return !this.chatMuted() && !this.gameIsFinished;
  }

  /** Non-blocking banner; dismissed after you play or draw. */
  showYourTurnBanner(): boolean {
    return this.isMyTurn && !this.yourTurnBannerDismissed();
  }

  get isHost(): boolean {
    const uid = this.myUserId;
    const hid = this.session()?.host_user_id;
    if (uid === null || hid === null || hid === undefined) return false;
    return Number(uid) === Number(hid);
  }

  isCardPlayable(card: { color?: string; value?: string } | null | undefined): boolean {
    if (!card || typeof card !== 'object') return false;
    const state = this.unoState;
    if (!state) return false;
    const color = card.color;
    const value = card.value;
    if (color === undefined || color === null || color === '') return false;
    if (value === undefined || value === null || value === '') return false;
    if (color === 'w') {
      return true;
    }
    if (state.currentColor === color) return true;
    if (state.currentValue === value) return true;
    return false;
  }

  hasAnyPlayable(): boolean {
    if (!this.isMyTurn) return false;
    return this.myHand().some((c) => this.isCardPlayable(c));
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

  /**
   * Matches `.opponents { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px }`
   * so one wide column isn’t treated as half the table width.
   */
  private opponentGridColumnCount(): number {
    const W = Math.max(0, this.containerWidth());
    const minCol = 160;
    const gap = 12;
    return Math.max(1, Math.floor((W + gap) / (minCol + gap)));
  }

  private opponentPanelCount(): number {
    const uid = this.myUserId;
    const players = this.unoState?.players;
    if (!players || !Array.isArray(players)) return 1;
    return Math.max(1, players.filter((p: any) => Number(p.user_id) !== Number(uid)).length);
  }

  /**
   * Width for one opponent row: matches `auto-fit` collapsing empty tracks — a lone opponent
   * uses the full row width, not `1 / maxColumns`.
   */
  private opponentRailUsableWidth(): number {
    const maxCols = this.opponentGridColumnCount();
    const gap = 12;
    const W = Math.max(0, this.containerWidth());
    const n = this.opponentPanelCount();
    const colsUsed = Math.min(maxCols, n);
    const cell = (W - (colsUsed - 1) * gap) / colsUsed;
    const opponentHorizontalPadding = 28; // 14px × 2 on `.opponent`
    return Math.max(80, cell - opponentHorizontalPadding);
  }

  cardOverlapAmount(): number {
    const count = this.myHand().length;
    if (count <= 1) return 0;

    const cardWidth = 110; // md size card width
    const totalSpaceNeeded = cardWidth * count;
    const railPadding = 16; // `.myHand__rail` horizontal padding 8px × 2
    const usableWidth = Math.max(0, this.containerWidth() - railPadding);

    if (totalSpaceNeeded <= usableWidth) {
      return 0;
    }

    const spaceToSave = totalSpaceNeeded - usableWidth;
    return Math.max(0, spaceToSave / (count - 1));
  }

  /** Cards actually rendered in the opponent rail (capped; matches `opponentHandBacks`). */
  private opponentVisibleCardCount(handCount: number): number {
    return Math.max(0, Math.min(handCount, this.opponentBacksCap));
  }

  opponentCardOverlapAmount(handCount: number): number {
    const count = this.opponentVisibleCardCount(handCount);
    if (count <= 1) return 0;

    const cardWidth = 84; // sm size card width
    const totalSpaceNeeded = cardWidth * count;
    const usableWidth = this.opponentRailUsableWidth();

    if (totalSpaceNeeded <= usableWidth) {
      return 0;
    }

    const spaceToSave = totalSpaceNeeded - usableWidth;
    return Math.max(0, spaceToSave / (count - 1));
  }

  playersList(): any[] {
    const s: any = this.session();
    return Array.isArray(s?.players) ? s.players : [];
  }

  activeLobbyPlayers(): any[] {
    return this.playersList().filter((p: any) => !p.left_at);
  }

  cardCountLabelForUser(userId: number): string {
    const st = this.unoState;
    const status = this.session()?.status;
    if (!st?.players || (status !== 'in_progress' && status !== 'finished')) {
      return '—';
    }
    const row = st.players.find((p: any) => Number(p.user_id) === Number(userId));
    if (row && typeof row.handCount === 'number') {
      return row.handCount === 1 ? '1 card' : `${row.handCount} cards`;
    }
    if (Array.isArray(row?.hand)) {
      const n = row.hand.length;
      return n === 1 ? '1 card' : `${n} cards`;
    }
    return '—';
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

  formatStatus(status: string): string {
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  chooseWildColor(color: 'r' | 'g' | 'b' | 'y'): void {
    if (this.gameIsFinished) {
      return;
    }
    const idx = this.pendingWildCardIndex();
    if (idx === null) return;

    this.pendingWildCardIndex.set(null);
    this.submitPlayCard(idx, color);
  }

  cancelWildPicker(): void {
    this.pendingWildCardIndex.set(null);
  }

  playCard(cardIndex: number): void {
    if (!this.isMyTurn || this.gameIsFinished) return;

    const card = this.myHand()[cardIndex];
    if (!card) return;

    if (card.color !== 'w' && !this.isCardPlayable(card)) {
      this.snackBar.open('You can’t play that card right now.', 'Close', { duration: 3000 });
      return;
    }

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
    if (!s || s.status !== 'in_progress') return;

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
        next: (res) => {
          this.yourTurnBannerDismissed.set(true);
          this.session.set(res.results);
        },
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

  /** Flying card from deck to the hand slot that received the drawn card (after server response). */
  private animateDeckToHand(targetHandIndex: number): void {
    try {
      const deckRoot = document.querySelector('[data-uno-deck]') as HTMLElement | null;
      const deckCardHost = deckRoot?.querySelector('app-uno-card') as HTMLElement | null;
      const startEl = deckCardHost ?? deckRoot;
      if (!startEl) return;

      const handBtn = document.querySelector(
        `[data-hand-card-index="${targetHandIndex}"]`
      ) as HTMLElement | null;
      if (!handBtn) return;

      const endCardHost = handBtn.querySelector('app-uno-card') as HTMLElement | null;
      const endEl = endCardHost ?? handBtn;

      const startRect = startEl.getBoundingClientRect();
      const endRect = endEl.getBoundingClientRect();

      const clone = startEl.cloneNode(true) as HTMLElement;
      clone.style.position = 'fixed';
      clone.style.left = `${startRect.left}px`;
      clone.style.top = `${startRect.top}px`;
      clone.style.width = `${startRect.width}px`;
      clone.style.height = `${startRect.height}px`;
      clone.style.zIndex = '9999';
      clone.style.pointerEvents = 'none';
      clone.style.margin = '0';
      document.body.appendChild(clone);

      const dx = endRect.left - startRect.left;
      const dy = endRect.top - startRect.top;
      const scale = endRect.width > 0 && startRect.width > 0 ? endRect.width / startRect.width : 0.88;

      clone.animate(
        [
          { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0 },
        ],
        { duration: 460, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
      );

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
    if (!s || s.status !== 'in_progress') return;
    const clientVersion = (s.version ?? 0) as number;
    this.service
      .makeMove(s.id, { type: 'draw', payload: {}, clientVersion })
      .subscribe({
        next: (res) => {
          this.yourTurnBannerDismissed.set(true);
          const uid = this.myUserId;
          const state: any = res.results?.state;
          let lastHandIndex = 0;
          if (uid && state?.players && Array.isArray(state.players)) {
            const me = state.players.find((p: any) => Number(p.user_id) === Number(uid));
            const len = Array.isArray(me?.hand) ? me.hand.length : 0;
            lastHandIndex = Math.max(0, len - 1);
          }
          this.session.set(res.results);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => this.animateDeckToHand(lastHandIndex));
          });
        },
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
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Leave this game?',
          message: 'You will leave the session and return to the list.',
          confirmText: 'Leave',
          confirmColor: 'warn',
        },
        width: '420px',
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.service.leaveGameSession(s.id).subscribe({
          next: () => {
            this.snackBar.open('Left session', 'Close', { duration: 2500 });
            void this.router.navigate(['/game-sessions']);
          },
          error: (err) => {
            this.snackBar.open(err?.error?.message || 'Failed to leave', 'Close', {
              duration: 5000,
            });
          },
        });
      });
  }
}

