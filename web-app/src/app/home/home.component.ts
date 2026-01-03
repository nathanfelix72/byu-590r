import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthStore } from '../core/stores/auth.store';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatButtonModule, MatListModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  authStore = inject(AuthStore);
  router = inject(Router);

  listOfBooks = [
    'Harry Potter, J.K. Rowling',
    'Mistborn, Brandon Sanderson'
  ];

  logout(): void {
    this.authStore.logout();
    this.router.navigate(['/login']);
  }
}
