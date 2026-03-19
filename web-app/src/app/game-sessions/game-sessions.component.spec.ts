import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { GameSessionsComponent } from './game-sessions.component';
import { GameSessionStore } from '../core/stores/game-session.store';
import {
  GameSession,
  GameSessionService,
} from '../core/services/game-session.service';
import { GamesService } from '../core/services/games.service';

class MockGameSessionStore {
  private _sessions: GameSession[] = [];

  sessions() {
    return this._sessions;
  }

  setGameSessions(sessions: GameSession[]): void {
    this._sessions = sessions;
  }
}

class MockGameSessionService {
  private sessions: GameSession[] = [
    {
      id: 1,
      name: 'Test Session 1',
      description: 'Description 1',
      game_session_cover_picture: 'https://example.com/cover1.jpg',
      status: 'in_progress',
      current_turn: 0,
      created_at: '2025-03-16T12:00:00.000000Z',
    },
    {
      id: 2,
      name: 'Test Session 2',
      description: 'Description 2',
      game_session_cover_picture: null,
      status: 'waiting',
      current_turn: null,
      created_at: '2025-03-15T10:00:00.000000Z',
    },
  ];

  getMyGameSessions() {
    return of({
      success: true,
      results: this.sessions,
      message: 'My Game Sessions',
    });
  }

  // Legacy method still referenced elsewhere sometimes
  getGameSessions() {
    return of({
      success: true,
      results: this.sessions,
      message: 'Game Sessions',
    });
  }

  createGameSession() {
    return of({
      success: true,
      results: this.sessions[0],
      message: 'Game Session created',
    });
  }

  joinGameSession() {
    return of({
      success: true,
      results: this.sessions[0],
      message: 'Joined game session',
    });
  }

  joinGameSessionByCode() {
    return of({
      success: true,
      results: this.sessions[0],
      message: 'Joined game session',
    });
  }
}

class MockGamesService {
  getGames() {
    return of({
      success: true,
      results: [{ id: 1, key: 'uno', name: 'Uno', rules_version: 'v1', min_players: 2, max_players: 4 }],
      message: 'Games',
    });
  }
}

describe('GameSessionsComponent', () => {
  let component: GameSessionsComponent;
  let fixture: ComponentFixture<GameSessionsComponent>;
  let store: MockGameSessionStore;

  beforeEach(async () => {
    store = new MockGameSessionStore();

    await TestBed.configureTestingModule({
      imports: [GameSessionsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: GameSessionStore, useValue: store },
        { provide: GameSessionService, useClass: MockGameSessionService },
        { provide: GamesService, useClass: MockGamesService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GameSessionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load and display game sessions in table', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const cards = compiled.querySelectorAll('.sessionCard');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('Test Session 1');
    expect(cards[0].textContent).toContain('in_progress');
    expect(cards[1].textContent).toContain('Test Session 2');
    expect(cards[1].textContent).toContain('waiting');
  });

  it('should bind image src correctly', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const images = compiled.querySelectorAll('.sessionCard img');

    expect(images[0].getAttribute('src')).toBe(
      'https://example.com/cover1.jpg'
    );
    expect(images[1].getAttribute('src')).toBe(
      'assets/images/default-game-session.png'
    );
  });
}
);

