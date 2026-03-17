import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { GameSessionsComponent } from './game-sessions.component';
import { GameSessionStore } from '../core/stores/game-session.store';
import {
  GameSession,
  GameSessionService,
} from '../core/services/game-session.service';

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
  getGameSessions() {
    const sessions: GameSession[] = [
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

    return of({
      success: true,
      results: sessions,
      message: 'Game Sessions',
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
        { provide: GameSessionStore, useValue: store },
        { provide: GameSessionService, useClass: MockGameSessionService },
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
    const rows = compiled.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);

    const firstRowCells = rows[0].querySelectorAll('td');
    expect(firstRowCells[1].textContent).toContain('Test Session 1');
    expect(firstRowCells[2].textContent).toContain('Description 1');
    expect(firstRowCells[3].textContent).toContain('in_progress');
    expect(firstRowCells[4].textContent).toContain('1'); // current_turn 0 displayed as "1"

    const secondRowCells = rows[1].querySelectorAll('td');
    expect(secondRowCells[1].textContent).toContain('Test Session 2');
    expect(secondRowCells[2].textContent).toContain('Description 2');
    expect(secondRowCells[3].textContent).toContain('waiting');
    expect(secondRowCells[4].textContent).toContain('—');
  });

  it('should bind image src correctly', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const images = compiled.querySelectorAll('tbody tr img');

    expect(images[0].getAttribute('src')).toBe(
      'https://example.com/cover1.jpg'
    );
    expect(images[1].getAttribute('src')).toBe(
      'assets/images/default-game-session.png'
    );
  });
}
);

