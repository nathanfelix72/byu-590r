import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface Game {
  id: number;
  key: string;
  name: string;
  rules_version: string;
  min_players: number;
  max_players: number;
}

export interface GameTag {
  id: number;
  name: string;
  slug: string;
}

@Injectable({ providedIn: 'root' })
export class GamesService {
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

  getGames(): Observable<{ success: boolean; results: Game[]; message: string }> {
    return this.http.get<{ success: boolean; results: Game[]; message: string }>(
      `${this.apiUrl}games`,
      { headers: this.getAuthHeaders() }
    );
  }

  getTags(): Observable<{ success: boolean; results: GameTag[]; message: string }> {
    return this.http.get<{ success: boolean; results: GameTag[]; message: string }>(
      `${this.apiUrl}tags`,
      { headers: this.getAuthHeaders() }
    );
  }
}

