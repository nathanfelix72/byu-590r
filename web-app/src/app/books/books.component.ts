import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormsModule,
} from '@angular/forms';
import { BooksService, Book } from '../core/services/books.service';
import { BooksStore } from '../core/stores/books.store';
import {
  setFormErrors,
  clearFormErrors,
  getFieldError,
} from '../core/utils/form.utils';
import { isMobile } from '../core/utils/mobile.utils';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatChipsModule } from '@angular/material/chips';

@Component({
  selector: 'app-books',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatGridListModule,
    MatChipsModule,
  ],
  templateUrl: './books.component.html',
  styleUrl: './books.component.scss',
})
export class BooksComponent implements OnInit {
  private booksService = inject(BooksService);
  private booksStore = inject(BooksStore);
  private fb = inject(FormBuilder);

  books = this.booksStore.books;
  genres = this.booksStore.genres;

  dueDate = signal('');
  checkedOutBook = signal<Book | null>(null);
  editBook = signal<Partial<Book>>({});
  selectedDeleteBook = signal<Book | null>(null);

  newBookForm: FormGroup;
  editBookForm: FormGroup;

  editBookErrorMessage = signal<string | null>(null);
  newBookErrorMessage = signal<string | null>(null);
  reportSentMessage = signal<string | null>(null);

  createBookDialog = signal(false);
  deleteBookDialog = signal(false);
  editBookDialog = signal(false);
  editFileChangeDialogBtn = signal(false);

  bookIsUpdating = signal(false);
  bookIsDeleting = signal(false);
  bookIsCreating = signal(false);
  selectedFile = signal<File | null>(null);
  selectedEditFile = signal<File | null>(null);

  constructor() {
    this.newBookForm = this.fb.group({
      name: ['', [Validators.required]],
      description: ['', [Validators.required]],
      inventory_total_qty: [1, [Validators.required, Validators.min(1)]],
      genre_id: [1, [Validators.required]],
      file: [null, [Validators.required]],
    });

    this.editBookForm = this.fb.group({
      name: ['', [Validators.required]],
      description: ['', [Validators.required]],
      inventory_total_qty: [1, [Validators.required, Validators.min(1)]],
      genre_id: [1, [Validators.required]],
    });
  }

  ngOnInit(): void {
    this.getBooks();
  }

  getBooks(): void {
    this.booksService.getBooks().subscribe({
      next: (response) => {
        this.booksStore.setBooks(response.results);
      },
      error: (error) => {
        console.error('Error fetching books:', error);
      },
    });
  }

  sendReport(): void {
    this.booksService.sendReport().subscribe({
      next: () => {
        this.reportSentMessage.set('Report Sent Successfully!');
      },
      error: (error) => {
        console.error('Error sending report:', error);
      },
    });
  }

  checkoutBook(): void {
    const book = this.checkedOutBook();
    if (!book || !this.dueDate()) {
      return;
    }

    this.booksService.checkoutBook(book, this.dueDate()).subscribe({
      next: (response) => {
        this.booksStore.setBookCheckedQty(response.results.book);
        this.checkedOutBook.set(null);
        this.dueDate.set('');
      },
      error: (error) => {
        console.error('Error checking out book:', error);
      },
    });
  }

  returnBook(book: Book): void {
    this.booksService.returnBook(book).subscribe({
      next: (response) => {
        this.booksStore.setBookCheckedQty(response.results.book);
      },
      error: (error) => {
        console.error('Error returning book:', error);
      },
    });
  }

  openDeleteBookDialog(book: Book): void {
    this.selectedDeleteBook.set(book);
    this.deleteBookDialog.set(true);
  }

  openEditBookDialog(book: Book): void {
    this.editBook.set({ ...book });
    this.editBookForm.patchValue({
      name: book.name,
      description: book.description,
      inventory_total_qty: book.inventory_total_qty,
      genre_id: book.genre_id,
    });
    this.editBookDialog.set(true);
  }

  openCreateDialog(): void {
    this.newBookForm.reset({
      name: '',
      description: '',
      inventory_total_qty: 1,
      genre_id: 1,
      file: null,
    });
    this.selectedFile.set(null);
    this.createBookDialog.set(true);
  }

  closeCreateDialog(): void {
    this.newBookForm.reset();
    this.selectedFile.set(null);
    this.createBookDialog.set(false);
  }

  createBook(): void {
    if (!this.newBookForm.valid || !this.selectedFile()) {
      return;
    }

    this.bookIsCreating.set(true);
    this.newBookErrorMessage.set(null);
    clearFormErrors(this.newBookForm);

    const formValue = this.newBookForm.value;
    this.booksService.createBook(formValue, this.selectedFile()!).subscribe({
      next: (response) => {
        this.booksStore.addBook(response.results.book);
        this.closeCreateDialog();
        this.bookIsCreating.set(false);
      },
      error: (error) => {
        if (error?.error?.data && typeof error.error.data === 'object') {
          setFormErrors(this.newBookForm, error.error.data);
          this.newBookErrorMessage.set(
            'Please fix the validation errors below.'
          );
        } else {
          this.newBookErrorMessage.set(
            error?.error?.message || 'Error creating book'
          );
        }
        this.bookIsCreating.set(false);
      },
    });
  }

  updateBook(): void {
    if (!this.editBookForm.valid) {
      return;
    }

    this.bookIsUpdating.set(true);
    this.editBookErrorMessage.set(null);
    clearFormErrors(this.editBookForm);

    const book = { ...this.editBook(), ...this.editBookForm.value } as Book;

    if (this.selectedEditFile()) {
      this.booksService
        .updateBookPicture(book, this.selectedEditFile()!)
        .subscribe({
          next: (response) => {
            this.booksStore.updateBookPicture(response.results.book);
            this.updateBookDetails(book);
          },
          error: (error) => {
            if (error?.error?.data && typeof error.error.data === 'object') {
              setFormErrors(this.editBookForm, error.error.data);
              this.editBookErrorMessage.set(
                'Please fix the validation errors below.'
              );
            } else {
              this.editBookErrorMessage.set(
                error?.error?.message || 'Error updating book picture'
              );
            }
            this.bookIsUpdating.set(false);
          },
        });
    } else {
      this.updateBookDetails(book);
    }
  }

  private updateBookDetails(book: Book): void {
    this.booksService.updateBook(book).subscribe({
      next: (response) => {
        this.booksStore.setBook(response.results.book);
        this.editBookDialog.set(false);
        this.editFileChangeDialogBtn.set(false);
        this.editBook.set({});
        this.bookIsUpdating.set(false);
      },
      error: (error) => {
        if (error?.error?.data && typeof error.error.data === 'object') {
          setFormErrors(this.editBookForm, error.error.data);
          this.editBookErrorMessage.set(
            'Please fix the validation errors below.'
          );
        } else {
          this.editBookErrorMessage.set(
            error?.error?.message || 'Error updating book'
          );
        }
        this.bookIsUpdating.set(false);
      },
    });
  }

  deleteBook(): void {
    const book = this.selectedDeleteBook();
    if (!book) {
      return;
    }

    this.bookIsDeleting.set(true);
    this.booksService.deleteBook(book).subscribe({
      next: () => {
        this.booksStore.removeBook(book);
        this.selectedDeleteBook.set(null);
        this.bookIsDeleting.set(false);
        this.deleteBookDialog.set(false);
      },
      error: (error) => {
        console.error('Error deleting book:', error);
        this.bookIsDeleting.set(false);
      },
    });
  }

  onNewBookFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.selectedFile.set(file);
      this.newBookForm.patchValue({ file: file });
      this.newBookForm.get('file')?.updateValueAndValidity();
    } else {
      this.selectedFile.set(null);
      this.newBookForm.patchValue({ file: null });
      this.newBookForm.get('file')?.updateValueAndValidity();
    }
  }

  onExistingBookPictureChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedEditFile.set(input.files[0]);
    }
  }

  isMobile = isMobile;

  getFieldError = getFieldError;
}
