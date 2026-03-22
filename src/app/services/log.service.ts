import { Injectable } from '@angular/core';

declare global {
  interface Window {
    electronAPI?: {
      appendLog: (entry: string) => void;
    };
  }
}

@Injectable({ providedIn: 'root' })
export class LogService {
  log(action: string, detail: string): void {
    const ts = new Date().toLocaleString();
    const entry = `[${ts}] ${action}: ${detail}`;
    if (window.electronAPI?.appendLog) {
      window.electronAPI.appendLog(entry);
    }
  }
}
