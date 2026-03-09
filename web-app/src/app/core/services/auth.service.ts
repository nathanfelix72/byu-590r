import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  password_confirmation: string;
}

export interface AuthResponse {
  token: string;
  name: string;
  avatar?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  login(user: LoginRequest): Observable<{ success: boolean; results: AuthResponse; message: string }> {
    const formData = new FormData();
    formData.append('email', user.email);
    formData.append('password', user.password);
    return this.http.post<{ success: boolean; results: AuthResponse; message: string }>(
      `${this.apiUrl}login`,
      formData
    );
  }

  /** Calls POST /api/logout with Bearer token, then on success removes user from localStorage. */
  logout(): Observable<{ success: boolean; results: unknown; message: string }> {
    const user = this.getStoredUser();
    const headers = new HttpHeaders(
      user?.token ? { Authorization: `Bearer ${user.token}` } : {}
    );
    return this.http
      .post<{ success: boolean; results: unknown; message: string }>(
        `${this.apiUrl}logout`,
        {},
        { headers }
      )
      .pipe(tap(() => localStorage.removeItem('user')));
  }

  register(user: RegisterRequest): Observable<{ success: boolean; results: AuthResponse; message: string }> {
    return this.http.post<{ success: boolean; results: AuthResponse; message: string }>(
      `${this.apiUrl}register`,
      user
    );
  }

  forgotPassword(email: string): Observable<{ success: boolean; message: string }> {
    const formData = new FormData();
    formData.append('email', email);
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiUrl}forgot_password`,
      formData
    );
  }

  /** GET: Validate reset token (e.g. from email link). */
  validateResetToken(rememberToken: string): Observable<{ success: boolean; message: string }> {
    return this.http.get<{ success: boolean; message: string }>(
      `${this.apiUrl}password_reset`,
      { params: { remember_token: rememberToken } }
    );
  }

  /** POST: Set new password using the reset token. */
  setNewPassword(rememberToken: string, password: string, passwordConfirmation: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiUrl}password_reset`,
      { remember_token: rememberToken, password, password_confirmation: passwordConfirmation }
    );
  }

  getStoredUser(): AuthResponse | null {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      return JSON.parse(userStr);
    }
    return null;
  }

  storeUser(user: AuthResponse): void {
    localStorage.setItem('user', JSON.stringify(user));
  }

  /** Removes user from localStorage (e.g. after logout or on error). */
  clearUser(): void {
    localStorage.removeItem('user');
  }
}

