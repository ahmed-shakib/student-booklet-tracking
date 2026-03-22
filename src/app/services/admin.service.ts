import { Injectable, signal } from '@angular/core';
import { AdminSettings } from '../models/admin-settings.model';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly storageKey = 'sbt_admin_settings';

  private _settings = signal<AdminSettings>(this.loadSettings());
  readonly settings = this._settings.asReadonly();

  private loadSettings(): AdminSettings {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : { centerName: '', logoDataUrl: '', passwordHash: '' };
    } catch {
      return { centerName: '', logoDataUrl: '', passwordHash: '' };
    }
  }

  getSettings(): AdminSettings {
    return this._settings();
  }

  saveSettings(settings: AdminSettings): void {
    localStorage.setItem(this.storageKey, JSON.stringify(settings));
    this._settings.set({ ...settings });
  }

  updateCenterName(name: string): void {
    const s = { ...this._settings(), centerName: name };
    this.saveSettings(s);
  }

  updateLogo(dataUrl: string): void {
    const s = { ...this._settings(), logoDataUrl: dataUrl };
    this.saveSettings(s);
  }

  setPassword(newPassword: string): void {
    const hash = this.hashPassword(newPassword);
    const s = { ...this._settings(), passwordHash: hash };
    this.saveSettings(s);
  }

  verifyPassword(password: string): boolean {
    const settings = this._settings();
    if (!settings.passwordHash) return true;
    return this.hashPassword(password) === settings.passwordHash;
  }

  hasPassword(): boolean {
    return !!this._settings().passwordHash;
  }

  private hashPassword(password: string): string {
    // Deterministic hash for local desktop app password protection
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < password.length; i++) {
      const ch = password.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  }
}
