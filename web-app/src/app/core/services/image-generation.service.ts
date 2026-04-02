import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class ImageGenerationService {
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

  /**
   * Generate a game session cover image
   * @param title - The game session title
   * @param description - Optional game session description
   */
  generateSessionCover(
    title: string,
    description?: string
  ): Observable<{ success: boolean; results: { image_url: string }; message: string }> {
    return this.http.post<{ success: boolean; results: { image_url: string }; message: string }>(
      `${this.apiUrl}generate-image/session-cover`,
      { title, description: description || '' },
      { headers: this.getAuthHeaders() }
    );
  }

  /**
   * Generate an UNO board background image
   * @param theme - The theme for the UNO board
   * @param description - Optional description
   */
  generateUnoBoardBackground(
    theme: string,
    description?: string
  ): Observable<{ success: boolean; results: { image_url: string }; message: string }> {
    return this.http.post<{ success: boolean; results: { image_url: string }; message: string }>(
      `${this.apiUrl}generate-image/uno-background`,
      { theme, description: description || '' },
      { headers: this.getAuthHeaders() }
    );
  }
}
