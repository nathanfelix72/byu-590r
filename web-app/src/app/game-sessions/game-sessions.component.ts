import { Component, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameSessionStore } from '../core/stores/game-session.store';
import { GameSessionService } from '../core/services/game-session.service';

@Component({
  selector: 'app-game-sessions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-sessions.component.html',
  styleUrl: './game-sessions.component.scss',
})
export class GameSessionsComponent implements OnInit {
  private gameSessionStore = inject(GameSessionStore);
  private gameSessionService = inject(GameSessionService);

  gameSessions = computed(() => this.gameSessionStore.sessions());

  ngOnInit(): void {
    this.loadGameSessions();
  }

  loadGameSessions(): void {
    this.gameSessionService.getGameSessions().subscribe({
      next: (response) => {
        this.gameSessionStore.setGameSessions(response.results);
      },
      error: (error) => {
        console.error('Error fetching game sessions:', error);
      },
    });
  }
}

