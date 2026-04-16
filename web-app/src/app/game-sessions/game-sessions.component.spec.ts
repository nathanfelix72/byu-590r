/// <reference types="jasmine" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';
import { GameSessionsComponent } from './game-sessions.component';
import {
  GameSession,
  GameSessionService,
} from '../core/services/game-session.service';
import { GamesService } from '../core/services/games.service';
import { AuthStore } from '../core/stores/auth.store';

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
      host_user_id: 1,
    },
    {
      id: 2,
      name: 'Test Session 2',
      description: 'Description 2',
      game_session_cover_picture: null,
      status: 'in_progress',
      current_turn: null,
      created_at: '2025-03-15T10:00:00.000000Z',
      host_user_id: 2,
    },
  ];

  getMyGameSessions() {
    return of({
      success: true,
      results: this.sessions,
      message: 'My Game Sessions',
    });
  }

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

  deleteGameSession() {
    return of({ success: true, results: {}, message: 'ok' });
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

  getTags() {
    return of({
      success: true,
      results: [],
      message: 'Tags',
    });
  }
}

const mockAuth = {
  user: () => ({ id: 1, name: 'Tester', token: 't' }),
};

describe('GameSessionsComponent', () => {
  let component: GameSessionsComponent;
  let fixture: ComponentFixture<GameSessionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameSessionsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideMockStore({
          initialState: {
            gameSessions: {
              sessions: [
                {
                  id: 1,
                  name: 'Test Session 1',
                  description: 'Description 1',
                  game_session_cover_picture: 'https://example.com/cover1.jpg',
                  status: 'in_progress',
                  current_turn: 0,
                  created_at: '2025-03-16T12:00:00.000000Z',
                  host_user_id: 1,
                },
                {
                  id: 2,
                  name: 'Test Session 2',
                  description: 'Description 2',
                  game_session_cover_picture: null,
                  status: 'in_progress',
                  current_turn: null,
                  created_at: '2025-03-15T10:00:00.000000Z',
                  host_user_id: 2,
                },
              ],
              loading: false,
              error: null,
            },
          },
        }),
        { provide: GameSessionService, useClass: MockGameSessionService },
        { provide: GamesService, useClass: MockGamesService },
        { provide: AuthStore, useValue: mockAuth },
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
    expect(cards[0].textContent).toContain('In Progress');
    expect(cards[1].textContent).toContain('Test Session 2');
    expect(cards[1].textContent).toContain('In Progress');
  });

  it('should bind image src correctly', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const images = compiled.querySelectorAll('.sessionCard img');

    expect(images.length).toBeGreaterThanOrEqual(2);
    if (images[0]) {
      expect(images[0].getAttribute('src')).toBe(
        'https://example.com/cover1.jpg'
      );
    }
    if (images[1]) {
      expect(images[1].getAttribute('src')).toBe(
        component.defaultCoverImage
      );
    }
  });
});
