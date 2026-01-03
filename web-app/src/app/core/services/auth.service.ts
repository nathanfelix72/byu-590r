import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  c_password: string;
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

  logout(): void {
    localStorage.removeItem('user');
  }

  register(user: RegisterRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}register`, user);
  }

  forgotPassword(email: string): Observable<any> {
    const formData = new FormData();
    formData.append('email', email);
    return this.http.post(`${this.apiUrl}forgot_password`, formData);
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
}

