import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
})
export class AdminComponent implements OnInit {
  private adminService = inject(AdminService);

  centerName = signal('');
  logoDataUrl = signal('');

  // Password fields
  currentPassword = signal('');
  newPassword = signal('');
  confirmPassword = signal('');

  showCurrentPwd = signal(false);
  showNewPwd = signal(false);
  showConfirmPwd = signal(false);

  saveMessage = signal('');
  saveError = signal('');
  passwordMessage = signal('');
  passwordError = signal('');

  ngOnInit(): void {
    const settings = this.adminService.getSettings();
    this.centerName.set(settings.centerName);
    this.logoDataUrl.set(settings.logoDataUrl);
  }

  onLogoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      this.saveError.set('Please upload a valid image file (PNG, JPG, GIF, WEBP, SVG).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      this.saveError.set('Image must be smaller than 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.logoDataUrl.set(e.target!.result as string);
      this.saveError.set('');
    };
    reader.readAsDataURL(file);
  }

  removeLogo(): void {
    this.logoDataUrl.set('');
  }

  saveGeneralSettings(): void {
    this.saveError.set('');
    const name = this.centerName().trim();
    if (!name) {
      this.saveError.set('Center name cannot be empty.');
      return;
    }
    this.adminService.saveSettings({
      ...this.adminService.getSettings(),
      centerName: name,
      logoDataUrl: this.logoDataUrl(),
    });
    this.saveMessage.set('Settings saved successfully!');
    setTimeout(() => this.saveMessage.set(''), 3000);
  }

  savePassword(): void {
    this.passwordError.set('');
    this.passwordMessage.set('');
    const current = this.currentPassword();
    const next = this.newPassword();
    const confirm = this.confirmPassword();

    if (this.adminService.hasPassword()) {
      if (!this.adminService.verifyPassword(current)) {
        this.passwordError.set('Current password is incorrect.');
        return;
      }
    }

    if (!next || next.length < 4) {
      this.passwordError.set('New password must be at least 4 characters.');
      return;
    }

    if (next !== confirm) {
      this.passwordError.set('New passwords do not match.');
      return;
    }

    this.adminService.setPassword(next);
    this.currentPassword.set('');
    this.newPassword.set('');
    this.confirmPassword.set('');
    this.passwordMessage.set('Password updated successfully!');
    setTimeout(() => this.passwordMessage.set(''), 3000);
  }

  get hasExistingPassword(): boolean {
    return this.adminService.hasPassword();
  }
}
