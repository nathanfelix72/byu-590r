import { computed } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { Book } from '../services/books.service';

export interface Genre {
  id: number;
  name: string;
}

export interface BooksState {
  booksList: Book[];
  genres: Genre[];
}

const initialState: BooksState = {
  booksList: [],
  genres: [],
};

export const BooksStore = signalStore(
  { providedIn: 'root' },
  withState<BooksState>(initialState),
  withComputed(({ booksList }) => ({
    books: computed(() => {
      return booksList().map((book) => ({
        ...book,
        available_qty: book.inventory_total_qty - book.checked_qty,
      }));
    }),
    genres: computed(() => {
      const genreMap = new Map<number, Genre>();
      for (const book of booksList()) {
        if (book.genre && !genreMap.has(book.genre.id)) {
          genreMap.set(book.genre.id, {
            id: book.genre.id,
            name: book.genre.name,
          });
        }
      }
      return Array.from(genreMap.values());
    }),
  })),
  withMethods((store) => ({
    setBooks(books: Book[]): void {
      patchState(store, {
        booksList: books,
      });
    },
    setBookCheckedQty(book: Book): void {
      const currentBooks = store.booksList();
      const index = currentBooks.findIndex((b) => b.id === book.id);
      if (index !== -1) {
        const updatedBooks = [...currentBooks];
        updatedBooks[index] = {
          ...updatedBooks[index],
          checked_qty: book.checked_qty,
          available_qty: book.inventory_total_qty - book.checked_qty,
        };
        patchState(store, {
          booksList: updatedBooks,
        });
      }
    },
    addBook(book: Book): void {
      const currentBooks = store.booksList();
      patchState(store, {
        booksList: [...currentBooks, book],
      });
    },
    setBook(book: Book): void {
      const currentBooks = store.booksList();
      const index = currentBooks.findIndex((b) => b.id === book.id);
      if (index !== -1) {
        const updatedBooks = [...currentBooks];
        updatedBooks[index] = {
          ...book,
          available_qty: book.inventory_total_qty - book.checked_qty,
        };
        patchState(store, {
          booksList: updatedBooks,
        });
      }
    },
    removeBook(book: Book): void {
      const currentBooks = store.booksList();
      patchState(store, {
        booksList: currentBooks.filter((b) => b.id !== book.id),
      });
    },
    updateBookPicture(book: Book): void {
      const currentBooks = store.booksList();
      const index = currentBooks.findIndex((b) => b.id === book.id);
      if (index !== -1) {
        const updatedBooks = [...currentBooks];
        updatedBooks[index] = {
          ...updatedBooks[index],
          file: book.file,
        };
        patchState(store, {
          booksList: updatedBooks,
        });
      }
    },
  }))
);
