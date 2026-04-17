import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface GameSessionPlayerPivot {
  id?: number;
  user_id: number;
  score?: number;
  seat?: number | null;
  is_ready?: boolean;
  is_ai?: boolean;
  /** Present only for the authenticated user’s row; hidden for other players. */
  chat_muted?: boolean;
  left_at?: string | null;
  user?: {
    id?: number;
    name?: string;
    avatar?: string | null;
  } | null;
}

export interface GameSessionChatMessage {
  id: number;
  body: string;
  user_id: number;
  user_name: string;
  created_at?: string | null;
}

export interface GameSessionTag {
  id: number;
  name: string;
  slug?: string;
}

export interface GameSessionDetail {
  id?: number;
  game_session_id?: number;
  notes: string | null;
  max_players_cap: number | null;
}

export interface GameSession {
  id: number;
  game_id?: number | null;
  host_user_id?: number | null;
  players?: GameSessionPlayerPivot[];
  host?: {
    id?: number;
    name?: string;
    avatar?: string | null;
  } | null;
  name: string;
  description: string;
  game_session_cover_picture: string | null;
  game_session_background_picture?: string | null;
  status: string;
  current_turn: number | null;
  /** Set when the host starts the game (status becomes in_progress). */
  started_at?: string | null;
  join_code?: string | null;
  state?: any;
  version?: number;
  created_at: string;
  detail?: GameSessionDetail | null;
  tags?: GameSessionTag[];
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
    notes?: string | null;
    max_players_cap?: number | null;
    tag_ids?: number[];
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

  deleteGameSession(
    id: number
  ): Observable<{ success: boolean; results: any; message: string }> {
    return this.http.delete<{ success: boolean; results: any; message: string }>(
      `${this.apiUrl}game-sessions/${id}`,
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

  playAgain(id: number): Observable<{
    success: boolean;
    results: { session: GameSession; new_session_id: number | null };
    message: string;
  }> {
    return this.http.post<{
      success: boolean;
      results: { session: GameSession; new_session_id: number | null };
      message: string;
    }>(`${this.apiUrl}game-sessions/${id}/play-again`, {}, { headers: this.getAuthHeaders() });
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

  getChat(
    id: number
  ): Observable<{ success: boolean; results: GameSessionChatMessage[]; message: string }> {
    return this.http.get<{
      success: boolean;
      results: GameSessionChatMessage[];
      message: string;
    }>(`${this.apiUrl}game-sessions/${id}/chat`, { headers: this.getAuthHeaders() });
  }

  postChat(
    id: number,
    body: string
  ): Observable<{ success: boolean; results: GameSessionChatMessage; message: string }> {
    return this.http.post<{
      success: boolean;
      results: GameSessionChatMessage;
      message: string;
    }>(
      `${this.apiUrl}game-sessions/${id}/chat`,
      { body },
      { headers: this.getAuthHeaders() }
    );
  }

  updateChatMute(
    id: number,
    chat_muted: boolean
  ): Observable<{ success: boolean; results: GameSession; message: string }> {
    return this.http.patch<{ success: boolean; results: GameSession; message: string }>(
      `${this.apiUrl}game-sessions/${id}/chat-mute`,
      { chat_muted },
      { headers: this.getAuthHeaders() }
    );
  }

  updateGameSession(
    id: number,
    payload: {
      name?: string;
      description?: string;
      game_id?: number;
      notes?: string | null;
      max_players_cap?: number | null;
      tag_ids?: number[];
    }
  ): Observable<{ success: boolean; results: GameSession; message: string }> {
    return this.http.patch<{ success: boolean; results: GameSession; message: string }>(
      `${this.apiUrl}game-sessions/${id}`,
      payload,
      { headers: this.getAuthHeaders() }
    );
  }
}

