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

  gameSessions = computed(() => this.gameSessionStore.sessions());
  games = signal<Game[]>([]);

  createOpen = signal(false);
  joinOpen = signal(false);

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
        console.error('Error fetching game sessions:', error);
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
    this.gameSessionService
      .createGameSession({
        game_id: value.game_id!,
        name: value.name!,
        description: value.description || '',
      })
      .subscribe({
        next: () => {
          this.snackBar.open('Session created', 'Close', { duration: 3000 });
          this.createOpen.set(false);
          this.createForm.reset();
          this.loadMyGameSessions();
        },
        error: (err) => {
          this.snackBar.open(
            err?.error?.message || 'Failed to create session',
            'Close',
            { duration: 5000 }
          );
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
}

