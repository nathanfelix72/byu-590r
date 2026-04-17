import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { GameSessionService, GameSession } from '../../core/services/game-session.service';
import { Game, GameTag } from '../../core/services/games.service';

export interface EditSessionDialogData {
  session: GameSession;
  games: Game[];
  tags: GameTag[];
}

function optionalRoomSize(control: AbstractControl): ValidationErrors | null {
  const v = control.value;
  if (v === null || v === '' || v === undefined) {
    return null;
  }
  const n = Number(v);
  if (Number.isNaN(n) || n < 2 || n > 20) {
    return { roomSize: { min: 2, max: 20 } };
  }
  return null;
}

@Component({
  selector: 'app-edit-session-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './edit-session-dialog.component.html',
  styleUrl: './edit-session-dialog.component.scss',
})
export class EditSessionDialogComponent {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<EditSessionDialogComponent, boolean>);
  private gameSessionService = inject(GameSessionService);
  private snackBar = inject(MatSnackBar);
  data = inject<EditSessionDialogData>(MAT_DIALOG_DATA);

  saving = false;

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    description: ['', [Validators.maxLength(500)]],
    game_id: [null as number | null, [Validators.required]],
    notes: ['', [Validators.maxLength(2000)]],
    max_players_cap: [null as number | null, [optionalRoomSize]],
    tag_ids: [[] as number[]],
  });

  constructor() {
    const s = this.data.session;
    this.form.patchValue({
      name: s.name,
      description: s.description,
      game_id: s.game_id ?? null,
      notes: s.detail?.notes ?? '',
      max_players_cap: s.detail?.max_players_cap ?? null,
      tag_ids: s.tags?.map((t) => t.id) ?? [],
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  save(): void {
    if (!this.form.valid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving = true;
    const capRaw = v.max_players_cap as number | null | undefined;
    const maxPlayersCap =
      capRaw === null || capRaw === undefined ? null : Number(capRaw);

    const payload: Parameters<GameSessionService['updateGameSession']>[1] = {
      name: v.name!,
      description: v.description ?? '',
      notes: (v.notes || '').trim() || null,
      max_players_cap: maxPlayersCap,
      tag_ids: v.tag_ids ?? [],
    };
    if (this.data.session.status === 'waiting' && v.game_id != null) {
      payload.game_id = v.game_id;
    }

    this.gameSessionService.updateGameSession(this.data.session.id, payload).subscribe({
      next: () => {
        this.saving = false;
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.saving = false;
        this.snackBar.open(
          err?.error?.message || 'Could not save changes',
          'Close',
          { duration: 5000 }
        );
      },
    });
  }
}
