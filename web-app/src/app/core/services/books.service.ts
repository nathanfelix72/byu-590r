import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface Book {
  id: number;
  name: string;
  description: string;
  file: string;
  genre_id: number;
  checked_qty: number;
  inventory_total_qty: number;
  available_qty?: number;
  genre?: { id: number; name: string };
  authors?: Array<{
    id: number;
    first_name: string;
    last_name: string;
    phones?: Array<{ phone_number: string; type: string }>;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class BooksService {
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
        Authorization: `Bearer ${user.token}`
      };
    }
    return {};
  }

  getBooks(): Observable<{ success: boolean; results: Book[]; message: string }> {
    return this.http.get<{ success: boolean; results: Book[]; message: string }>(
      `${this.apiUrl}books`,
      { headers: this.getAuthHeaders() }
    );
  }

  returnBook(book: Book): Observable<{ success: boolean; results: { book: Book }; message: string }> {
    return this.http.patch<{ success: boolean; results: { book: Book }; message: string }>(
      `${this.apiUrl}books/${book.id}/return`,
      {},
      { headers: this.getAuthHeaders() }
    );
  }

  sendReport(): Observable<any> {
    return this.http.post(
      `${this.apiUrl}send_book_report`,
      {},
      { headers: this.getAuthHeaders() }
    );
  }

  checkoutBook(book: Book, dueDate: string): Observable<{ success: boolean; results: { book: Book }; message: string }> {
    const formData = new FormData();
    formData.append('due_date', dueDate);
    return this.http.post<{ success: boolean; results: { book: Book }; message: string }>(
      `${this.apiUrl}books/${book.id}/checkout`,
      formData,
      { headers: this.getAuthHeaders() }
    );
  }

  createBook(book: Partial<Book>, file: File): Observable<{ success: boolean; results: { book: Book }; message: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', book.name!);
    formData.append('description', book.description!);
    formData.append('genre_id', book.genre_id!.toString());
    formData.append('inventory_total_qty', book.inventory_total_qty!.toString());
    return this.http.post<{ success: boolean; results: { book: Book }; message: string }>(
      `${this.apiUrl}books`,
      formData,
      { headers: this.getMultipartAuthHeaders() }
    );
  }

  updateBook(book: Book): Observable<{ success: boolean; results: { book: Book }; message: string }> {
    return this.http.put<{ success: boolean; results: { book: Book }; message: string }>(
      `${this.apiUrl}books/${book.id}`,
      book,
      { headers: this.getAuthHeaders() }
    );
  }

  deleteBook(book: Book): Observable<{ success: boolean; results: { book: { id: number } }; message: string }> {
    return this.http.delete<{ success: boolean; results: { book: { id: number } }; message: string }>(
      `${this.apiUrl}books/${book.id}`,
      { headers: this.getAuthHeaders() }
    );
  }

  updateBookPicture(book: Book, file: File): Observable<{ success: boolean; results: { book: Book }; message: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ success: boolean; results: { book: Book }; message: string }>(
      `${this.apiUrl}books/${book.id}/update_book_picture`,
      formData,
      { headers: this.getMultipartAuthHeaders() }
    );
  }
}

