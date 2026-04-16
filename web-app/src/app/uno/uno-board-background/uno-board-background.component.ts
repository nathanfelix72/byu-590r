import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Isolated board art: OnPush + stable subtree so parent session updates don’t re-touch the image layer.
 */
@Component({
  selector: 'app-uno-board-background',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (imageUrl(); as src) {
      <div class="uno-photo" aria-hidden="true">
        <img
          class="uno-photo__img"
          [src]="src"
          alt=""
          draggable="false"
          loading="eager"
        />
        <div class="uno-photo__wash" aria-hidden="true"></div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: contents;
      }
      .uno-photo {
        position: absolute;
        inset: 0;
        z-index: 0;
        border-radius: inherit;
        overflow: hidden;
        contain: strict;
        pointer-events: none;
        transform: translateZ(0);
        backface-visibility: hidden;
      }
      .uno-photo__img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
      }
      .uno-photo__wash {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          180deg,
          rgba(0, 0, 0, 0.1) 0%,
          rgba(0, 0, 0, 0.22) 100%
        );
        pointer-events: none;
      }
    `,
  ],
})
export class UnoBoardBackgroundComponent {
  readonly imageUrl = input<string | null>(null);
}
