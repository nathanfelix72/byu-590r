import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

type UnoColor = 'r' | 'g' | 'b' | 'y' | 'w';

export type UnoCard = {
  color: UnoColor;
  value: string; // "0"-"9" | "skip" | "reverse" | "draw2" | "wild" | "wild_draw4"
};

@Component({
  selector: 'app-uno-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './uno-card.component.html',
  styleUrl: './uno-card.component.scss',
})
export class UnoCardComponent {
  @Input({ required: true }) card!: UnoCard;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() faceDown = false;
  /** When discard shows wild / wild_draw4, paint the face with the active game color. */
  @Input() wildActiveColor: 'r' | 'g' | 'b' | 'y' | null = null;

  get colorName(): string {
    const c = this.card?.color;
    if (c === 'w' && this.wildActiveColor) {
      const w = this.wildActiveColor;
      return w === 'r'
        ? 'red'
        : w === 'g'
          ? 'green'
          : w === 'b'
            ? 'blue'
            : 'yellow';
    }
    return c === 'r'
      ? 'red'
      : c === 'g'
        ? 'green'
        : c === 'b'
          ? 'blue'
          : c === 'y'
            ? 'yellow'
            : 'wild';
  }

  get glyph(): string {
    const v = this.card?.value;
    if (!v) return '';
    if (v === 'reverse') return '↺';
    if (v === 'skip') return '⦸';
    if (v === 'draw2') return '+2';
    if (v === 'wild') return 'W';
    if (v === 'wild_draw4') return '+4';
    return v;
  }
}

