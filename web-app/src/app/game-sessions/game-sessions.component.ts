import { Component, OnInit, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { GameSessionStore } from '../core/stores/game-session.store';
import { GameSessionService } from '../core/services/game-session.service';
import { GamesService, Game } from '../core/services/games.service';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { ConfirmDialogComponent } from '../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-game-sessions',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatTabsModule,
  ],
  templateUrl: './game-sessions.component.html',
  styleUrl: './game-sessions.component.scss',
})
export class GameSessionsComponent implements OnInit {
  private gameSessionStore = inject(GameSessionStore);
  private gameSessionService = inject(GameSessionService);
  private gamesService = inject(GamesService);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  gameSessions = computed(() => this.gameSessionStore.sessions());
  games = signal<Game[]>([]);
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

  // Default SVG as data URL
  readonly defaultCoverImage = 'data:image/svg+xml,%3Csvg%20width=%22400%22%20height=%22300%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cdefs%3E%3ClinearGradient%20id=%22grad1%22%20x1=%220%25%22%20y1=%220%25%22%20x2=%22100%25%22%20y2=%22100%25%22%3E%3Cstop%20offset=%220%25%22%20style=%22stop-color:%23667eea;stop-opacity:1%22%20/%3E%3Cstop%20offset=%22100%25%22%20style=%22stop-color:%23764ba2;stop-opacity:1%22%20/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width=%22400%22%20height=%22300%22%20fill=%22url(%23grad1)%22/%3E%3Ccircle%20cx=%2280%22%20cy=%2280%22%20r=%2240%22%20fill=%22%23FF6B6B%22%20opacity=%220.8%22/%3E%3Ccircle%20cx=%22320%22%20cy=%2280%22%20r=%2240%22%20fill=%22%234ECDC4%22%20opacity=%220.8%22/%3E%3Ccircle%20cx=%2280%22%20cy=%22220%22%20r=%2240%22%20fill=%22%23FFE66D%22%20opacity=%220.8%22/%3E%3Ccircle%20cx=%22320%22%20cy=%22220%22%20r=%2240%22%20fill=%22%2395E1D3%22%20opacity=%220.8%22/%3E%3Ctext%20x=%22200%22%20y=%22150%22%20font-size=%2232%22%20font-weight=%22bold%22%20fill=%22white%22%20text-anchor=%22middle%22%20dominant-baseline=%22middle%22%3EGame%20Session%3C/text%3E%3C/svg%3E';

  createForm = this.fb.group({
    game_id: [null as number | null, [Validators.required]],
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
  });

  joinForm = this.fb.group({
    join_code: ['', [Validators.required, Validators.minLength(4)]],
  });

  ngOnInit(): void {
    this.loadGames();
    this.loadMyGameSessions();
  }

  loadGames(): void {
    this.gamesService.getGames().subscribe({
      next: (res) => this.games.set(res.results),
      error: () => this.games.set([]),
    });
  }

  loadMyGameSessions(): void {
    this.gameSessionService.getMyGameSessions().subscribe({
      next: (response) => {
        this.gameSessionStore.setGameSessions(response.results);
      },
      error: (error) => {
        this.snackBar.open('Error loading game sessions', 'Close', { duration: 3000 });
      },
    });
  }

  openCreate(): void {
    this.createOpen.set(true);
    this.joinOpen.set(false);
  }

  openJoin(): void {
    this.joinOpen.set(true);
    this.createOpen.set(false);
  }

  submitCreate(): void {
    if (!this.createForm.valid) return;

    const value = this.createForm.getRawValue();
    this.isGeneratingImage.set(true);

    this.gameSessionService
      .createGameSession({
        game_id: value.game_id!,
        name: value.name!,
        description: value.description || '',
      })
      .subscribe({
        next: () => {
          this.snackBar.open('Session created with generated images!', 'Close', {
            duration: 3000,
          });
          this.createOpen.set(false);
          this.createForm.reset();
          this.isGeneratingImage.set(false);
          this.loadMyGameSessions();
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
        this.loadMyGameSessions();
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
            this.loadMyGameSessions();
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

  getPlayerNames(session: any): string {
    if (!session.players || session.players.length === 0) {
      return 'No players yet';
    }
    return session.players
      .map((p: any) => p.user?.name || 'Player ' + p.user_id)
      .join(', ');
  }

  formatStatus(status: string): string {
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  getTabIndex(): number {
    const tab = this.selectedTab();
    return tab === 'in-progress' ? 0 : tab === 'finished' ? 1 : 2;
  }

  setTabIndex(index: number): void {
    if (index === 0) {
      this.selectedTab.set('in-progress');
    } else if (index === 1) {
      this.selectedTab.set('finished');
    } else {
      this.selectedTab.set('create');
    }
  }
}

