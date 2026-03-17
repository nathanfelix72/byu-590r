import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface GameSession {
  id: number;
  name: string;
  description: string;
  game_session_cover_picture: string | null;
  status: string;
  current_turn: number | null;
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
}

