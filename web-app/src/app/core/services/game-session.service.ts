import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface GameSession {
  id: number;
  game_id?: number | null;
  host_user_id?: number | null;
  host?: {
    id?: number;
    name?: string;
    avatar?: string | null;
  } | null;
  name: string;
  description: string;
  game_session_cover_picture: string | null;
  status: string;
  current_turn: number | null;
  join_code?: string | null;
  state?: any;
  version?: number;
  created_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class GameSessionService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = environment.apiUrl;

  private getAuthHeaders(): { [key: string]: string } {
    const user = this.authService.getStoredUser();
    if (user && user.token) {
      return { Authorization: `Bearer ${user.token}` };
    }
    return {};
  }

  getGameSessions(): Observable<{
    success: boolean;
    results: GameSession[];
    message: string;
  }> {
    return this.http.get<{
      success: boolean;
      results: GameSession[];
      message: string;
    }>(`${this.apiUrl}gamesessions`, {
      headers: this.getAuthHeaders(),
    });
  }

  getMyGameSessions(): Observable<{
    success: boolean;
    results: GameSession[];
    message: string;
  }> {
    return this.http.get<{
      success: boolean;
      results: GameSession[];
      message: string;
    }>(`${this.apiUrl}game-sessions`, { headers: this.getAuthHeaders() });
  }

  createGameSession(payload: {
    game_id: number;
    name: string;
    description?: string;
  }): Observable<{ success: boolean; results: GameSession; message: string }> {
    return this.http.post<{ success: boolean; results: GameSession; message: string }>(
      `${this.apiUrl}game-sessions`,
      payload,
      { headers: this.getAuthHeaders() }
    );
  }

  getGameSession(id: number): Observable<{
    success: boolean;
    results: GameSession;
    message: string;
  }> {
    return this.http.get<{
      success: boolean;
      results: GameSession;
      message: string;
    }>(`${this.apiUrl}game-sessions/${id}`, { headers: this.getAuthHeaders() });
  }

  joinGameSession(
    id: number,
    join_code?: string
  ): Observable<{ success: boolean; results: GameSession; message: string }> {
    return this.http.post<{ success: boolean; results: GameSession; message: string }>(
      `${this.apiUrl}game-sessions/${id}/join`,
      join_code ? { join_code } : {},
      { headers: this.getAuthHeaders() }
    );
  }

  joinGameSessionByCode(
    join_code: string
  ): Observable<{ success: boolean; results: GameSession; message: string }> {
    return this.http.post<{ success: boolean; results: GameSession; message: string }>(
      `${this.apiUrl}game-sessions/join`,
      { join_code },
      { headers: this.getAuthHeaders() }
    );
  }

  leaveGameSession(
    id: number
  ): Observable<{ success: boolean; results: any; message: string }> {
    return this.http.post<{ success: boolean; results: any; message: string }>(
      `${this.apiUrl}game-sessions/${id}/leave`,
      {},
      { headers: this.getAuthHeaders() }
    );
  }

  setReady(
    id: number,
    is_ready: boolean
  ): Observable<{ success: boolean; results: { is_ready: boolean }; message: string }> {
    return this.http.post<{
      success: boolean;
      results: { is_ready: boolean };
      message: string;
    }>(
      `${this.apiUrl}game-sessions/${id}/ready`,
      { is_ready },
      { headers: this.getAuthHeaders() }
    );
  }

  startGameSession(
    id: number
  ): Observable<{ success: boolean; results: GameSession; message: string }> {
    return this.http.post<{ success: boolean; results: GameSession; message: string }>(
      `${this.apiUrl}game-sessions/${id}/start`,
      {},
      { headers: this.getAuthHeaders() }
    );
  }

  makeMove(
    id: number,
    move: { type: string; payload?: any; clientVersion: number }
  ): Observable<{ success: boolean; results: GameSession; message: string }> {
    return this.http.post<{ success: boolean; results: GameSession; message: string }>(
      `${this.apiUrl}game-sessions/${id}/moves`,
      move,
      { headers: this.getAuthHeaders() }
    );
  }
}

