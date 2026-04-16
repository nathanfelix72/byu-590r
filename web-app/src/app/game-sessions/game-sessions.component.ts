import { Component, OnInit, inject, computed, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GameSessionService, GameSession } from '../core/services/game-session.service';
import { GamesService, Game, GameTag } from '../core/services/games.service';
import { AuthStore } from '../core/stores/auth.store';
import { gameSessionsFeature } from '../state/game-sessions/game-sessions.reducer';
import { gameSessionsActions } from '../state/game-sessions/game-sessions.actions';
import { ConfirmDialogComponent } from '../shared/confirm-dialog/confirm-dialog.component';
import { EditSessionDialogComponent } from './edit-session-dialog/edit-session-dialog.component';

function optionalRoomSize(control: AbstractControl): ValidationErrors | null {
  const v = control.value;
  if (v === null || v === '' || v === undefined) {
    return null;
  }
  const n = Number(v);
  if (Number.isNaN(n) || n < 2 || n > 20) {
    return { roomSize: { min: 2, max: 20 } };
  }
  return null;
}

@Component({
  selector: 'app-game-sessions',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './game-sessions.component.html',
  styleUrl: './game-sessions.component.scss',
})
export class GameSessionsComponent implements OnInit {
  private store = inject(Store);
  private gameSessionService = inject(GameSessionService);
  private gamesService = inject(GamesService);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authStore = inject(AuthStore);

  gameSessions = toSignal(this.store.select(gameSessionsFeature.selectSessions), {
    initialValue: [] as GameSession[],
  });
  sessionsLoading = toSignal(this.store.select(gameSessionsFeature.selectLoading), {
    initialValue: false,
  });
  sessionsError = toSignal(this.store.select(gameSessionsFeature.selectError), {
    initialValue: null as string | null,
  });

  games = signal<Game[]>([]);
  tags = signal<GameTag[]>([]);
  selectedTab = signal<'in-progress' | 'finished' | 'create'>('in-progress');

  inProgressSessions = computed(() =>
    this.gameSessions().filter((s) => s.status === 'waiting' || s.status === 'in_progress')
  );

  finishedSessions = computed(() =>
    this.gameSessions().filter((s) => s.status === 'finished')
  );

  createOpen = signal(false);
  joinOpen = signal(false);
  isGeneratingImage = signal(false);

  readonly defaultCoverImage =
    'data:image/svg+xml,%3Csvg%20width=%22400%22%20height=%22300%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cdefs%3E%3ClinearGradient%20id=%22grad1%22%20x1=%220%25%22%20y1=%220%25%22%20x2=%22100%25%22%20y2=%22100%25%22%3E%3Cstop%20offset=%220%25%22%20style=%22stop-color:%23667eea;stop-opacity:1%22%20/%3E%3Cstop%20offset=%22100%25%22%20style=%22stop-color:%23764ba2;stop-opacity:1%22%20/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width=%22400%22%20height=%22300%22%20fill=%22url(%23grad1)%22/%3E%3Ccircle%20cx=%2280%22%20cy=%2280%22%20r=%2240%22%20fill=%22%23FF6B6B%22%20opacity=%220.8%22/%3E%3Ccircle%20cx=%22320%22%20cy=%2280%22%20r=%2240%22%20fill=%22%234ECDC4%22%20opacity=%220.8%22/%3E%3Ccircle%20cx=%2280%22%20cy=%22220%22%20r=%2240%22%20fill=%22%23FFE66D%22%20opacity=%220.8%22/%3E%3Ccircle%20cx=%22320%22%20cy=%22220%22%20r=%2240%22%20fill=%22%2395E1D3%22%20opacity=%220.8%22/%3E%3Ctext%20x=%22200%22%20y=%22150%22%20font-size=%2232%22%20font-weight=%22bold%22%20fill=%22white%22%20text-anchor=%22middle%22%20dominant-baseline=%22middle%22%3EGame%20Session%3C/text%3E%3C/svg%3E';

  createForm = this.fb.group({
    game_id: [null as number | null, [Validators.required]],
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    description: ['', [Validators.maxLength(500)]],
    notes: ['', [Validators.maxLength(2000)]],
    max_players_cap: [null as number | null, [optionalRoomSize]],
    tag_ids: [[] as number[]],
  });

  joinForm = this.fb.group({
    join_code: ['', [Validators.required, Validators.minLength(4)]],
  });

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const tab = params.get('tab');
      if (tab === 'in-progress' || tab === 'finished' || tab === 'create') {
        this.selectedTab.set(tab);
      } else {
        this.selectedTab.set('in-progress');
        this.updateTabQuery('in-progress');
      }
    });

    this.store.dispatch(gameSessionsActions.loadMySessions());
    this.loadGames();
    this.loadTags();
  }

  loadGames(): void {
    this.gamesService.getGames().subscribe({
      next: (res) => this.games.set(res.results),
      error: () => this.games.set([]),
    });
  }

  loadTags(): void {
    this.gamesService.getTags().subscribe({
      next: (res) => this.tags.set(res.results),
      error: () => this.tags.set([]),
    });
  }

  isHost(session: GameSession): boolean {
    const uid = this.authStore.user()?.id;
    return uid != null && Number(session.host_user_id) === Number(uid);
  }

  openCreate(): void {
    this.selectedTab.set('create');
    this.updateTabQuery('create');
    this.createOpen.set(true);
    this.joinOpen.set(false);
  }

  openJoin(): void {
    this.selectedTab.set('create');
    this.updateTabQuery('create');
    this.joinOpen.set(true);
    this.createOpen.set(false);
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
          this.store.dispatch(gameSessionsActions.loadMySessions());
        }
      });
  }

  submitCreate(): void {
    if (!this.createForm.valid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const value = this.createForm.getRawValue();
    const gid = value.game_id != null ? Number(value.game_id) : NaN;
    if (Number.isNaN(gid)) {
      return;
    }

    const capRaw = value.max_players_cap as number | null | undefined;
    const maxPlayersCap =
      capRaw === null || capRaw === undefined ? null : Number(capRaw);

    this.isGeneratingImage.set(true);

    this.gameSessionService
      .createGameSession({
        game_id: gid,
        name: value.name!,
        description: value.description || '',
        notes: (value.notes || '').trim() || null,
        max_players_cap: maxPlayersCap,
        tag_ids: value.tag_ids?.length ? value.tag_ids : undefined,
      })
      .subscribe({
        next: () => {
          this.snackBar.open('Session created with generated images!', 'Close', {
            duration: 3000,
          });
          this.createOpen.set(false);
          this.createForm.reset({
            game_id: null,
            name: '',
            description: '',
            notes: '',
            max_players_cap: null,
            tag_ids: [],
          });
          this.isGeneratingImage.set(false);
          this.store.dispatch(gameSessionsActions.loadMySessions());
        },
        error: (err) => {
          this.snackBar.open(
            err?.error?.message || 'Failed to create session',
            'Close',
            { duration: 5000 }
          );
          this.isGeneratingImage.set(false);
        },
      });
  }

  submitJoin(): void {
    if (!this.joinForm.valid) return;
    const value = this.joinForm.getRawValue();

    const joinCode = (value.join_code || '').trim();
    if (!joinCode) {
      this.snackBar.open('Enter a join code.', 'Close', { duration: 5000 });
      return;
    }

    this.gameSessionService.joinGameSessionByCode(joinCode).subscribe({
      next: () => {
        this.snackBar.open('Joined session', 'Close', { duration: 3000 });
        this.joinOpen.set(false);
        this.joinForm.reset();
        this.store.dispatch(gameSessionsActions.loadMySessions());
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Failed to join', 'Close', {
          duration: 5000,
        });
      },
    });
  }

  deleteSession(sessionId: number, sessionName: string): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Session',
        message: `Are you sure you want to delete "${sessionName}"? This action cannot be undone.`,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.gameSessionService.deleteGameSession(sessionId).subscribe({
          next: () => {
            this.snackBar.open('Session deleted', 'Close', { duration: 3000 });
            this.store.dispatch(gameSessionsActions.loadMySessions());
          },
          error: (err) => {
            this.snackBar.open(
              err?.error?.message || 'Failed to delete session',
              'Close',
              { duration: 5000 }
            );
          },
        });
      }
    });
  }

  getPlayerNames(session: GameSession): string {
    if (!session.players || session.players.length === 0) {
      return 'No players yet';
    }
    return session.players
      .map((p) => p.user?.name || 'Player ' + p.user_id)
      .join(', ');
  }

  formatStatus(status: string): string {
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  statusClass(status: string): string {
    if (status === 'in_progress') return 'status-pill--in-progress';
    if (status === 'finished') return 'status-pill--finished';
    return 'status-pill--waiting';
  }

  statusIcon(status: string): string {
    if (status === 'in_progress') return '▶';
    if (status === 'finished') return '✓';
    return '⏳';
  }

  getCoverBgColor(sessionId: number): string {
    const colors = [
      '#c89a3d',
      '#1f5a3d',
      '#5ca27c',
      '#d8ae5d',
      '#4a6a5f',
      '#8b6f47',
      '#d9534f',
      '#7a9fb1',
      '#9b7b6f',
      '#6b7f6f',
    ];
    return colors[sessionId % colors.length];
  }

  getTabIndex(): number {
    const tab = this.selectedTab();
    return tab === 'in-progress' ? 0 : tab === 'finished' ? 1 : 2;
  }

  setTabIndex(index: number): void {
    if (index === 0) {
      this.selectedTab.set('in-progress');
      this.updateTabQuery('in-progress');
    } else if (index === 1) {
      this.selectedTab.set('finished');
      this.updateTabQuery('finished');
    } else {
      this.selectedTab.set('create');
      this.updateTabQuery('create');
    }
  }

  private updateTabQuery(tab: 'in-progress' | 'finished' | 'create'): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
