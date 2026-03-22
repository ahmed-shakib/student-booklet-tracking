import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-password-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './password-dialog.component.html',
  styleUrl: './password-dialog.component.css',
})
export class PasswordDialogComponent {
  @Input() visible = false;
  @Input() title = 'Enter Admin Password';
  @Input() errorMessage = '';
  @Output() confirmed = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<void>();

  password = '';
  showPassword = false;

  confirm(): void {
    this.confirmed.emit(this.password);
    this.password = '';
    this.showPassword = false;
  }

  cancel(): void {
    this.password = '';
    this.showPassword = false;
    this.cancelled.emit();
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('overlay')) {
      this.cancel();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.confirm();
    if (event.key === 'Escape') this.cancel();
  }
}
