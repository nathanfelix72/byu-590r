import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string | null;
  email_verified_at?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
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

  private getMultipartAuthHeaders(): { [key: string]: string } {
    const user = this.authService.getStoredUser();
    if (user && user.token) {
      return {
        Authorization: `Bearer ${user.token}`,
        'Content-Type': 'multipart/form-data'
      };
    }
    return {};
  }

  getUser(): Observable<{ success: boolean; results: User; message: string }> {
    return this.http.get<{ success: boolean; results: User; message: string }>(
      `${this.apiUrl}user`,
      { headers: this.getAuthHeaders() }
    );
  }

  uploadAvatar(image: File): Observable<{ success: boolean; results: { avatar: string }; message: string }> {
    const formData = new FormData();
    formData.append('image', image);
    return this.http.post<{ success: boolean; results: { avatar: string }; message: string }>(
      `${this.apiUrl}user/upload_avatar`,
      formData,
      { headers: this.getMultipartAuthHeaders() }
    );
  }

  removeAvatar(): Observable<{ success: boolean; results: { avatar: null }; message: string }> {
    return this.http.delete<{ success: boolean; results: { avatar: null }; message: string }>(
      `${this.apiUrl}user/remove_avatar`,
      { headers: this.getAuthHeaders() }
    );
  }

  sendVerificationEmail(emailData: any): Observable<any> {
    return this.http.post(
      `${this.apiUrl}user/send_verification_email`,
      emailData,
      { headers: this.getAuthHeaders() }
    );
  }

  changeEmail(changeEmail: { change_email: string }): Observable<{ success: boolean; results: { email: string }; message: string }> {
    return this.http.post<{ success: boolean; results: { email: string }; message: string }>(
      `${this.apiUrl}user/change_email`,
      changeEmail,
      { headers: this.getAuthHeaders() }
    );
  }
}

