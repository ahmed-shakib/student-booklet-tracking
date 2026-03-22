import { Component, inject, NgZone, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { AdminService } from '../../services/admin.service';
import { ExcelService } from '../../services/excel.service';
import { LogService } from '../../services/log.service';
import { PasswordDialogComponent } from '../password-dialog/password-dialog.component';
import { Student } from '../../models/student.model';

type DialogMode = 'import' | 'export' | 'delete' | null;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SUBJECTS = ['Math', 'English'];

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, PasswordDialogComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnDestroy {
  protected dataService = inject(DataService);
  private adminService = inject(AdminService);
  private excelService = inject(ExcelService);
  private logService = inject(LogService);
  private ngZone = inject(NgZone);

  readonly allDays = DAYS;
  readonly allSubjects = SUBJECTS;

  showPasswordDialog = signal(false);
  passwordError = signal('');
  pendingMode = signal<DialogMode>(null);
  pendingFile = signal<File | null>(null);
  pendingDeleteId = signal<string | null>(null);

  // Undo delete state
  undoStudents = signal<Student[]>([]);
  undoLabel = signal('');
  undoIndex = signal<number>(-1);
  private undoTimer: ReturnType<typeof setTimeout> | null = null;

  // Add subject state
  addSubjectForId = signal<string | null>(null);
  addSubjectDraft: { assignedDay: string; assignedTeacher: string; subject: string; currentLevel: string; currentWeek: string } = this.blankSubjectDraft();
  private blankSubjectDraft() {
    return { assignedDay: '', assignedTeacher: '', subject: '', currentLevel: '', currentWeek: '' };
  }

  filterText = signal('');
  filterSubject = signal('');
  filterDay = signal('');

  // Inline edit state
  editingId = signal<string | null>(null);
  editDraft = signal<Student | null>(null);

  // New row state
  showNewRow = signal(false);
  newRowDraft: Omit<Student, 'id'> = this.blankDraft();

  private blankDraft(): Omit<Student, 'id'> {
    return { studentName: '', assignedDay: '', assignedTeacher: '', subject: '', currentLevel: '', currentWeek: '' };
  }

  openNewRow(): void {
    this.cancelEdit();
    this.cancelAddSubject();
    this.newRowDraft = this.blankDraft();
    this.showNewRow.set(true);
    // Programmatically focus the first text input in the new row
    // after Angular has rendered it, bypassing any focus issues from dialogs
    setTimeout(() => {
      const input = document.querySelector('.new-row input.edit-input') as HTMLInputElement | null;
      if (input) input.focus();
    }, 50);
  }

  cancelNewRow(): void {
    this.showNewRow.set(false);
    this.newRowDraft = this.blankDraft();
  }

  saveNewRow(): void {
    const d = this.newRowDraft;
    if (!d.studentName.trim() || !d.assignedDay || !d.assignedTeacher.trim() || !d.subject || !d.currentLevel.trim() || !d.currentWeek.trim()) {
      alert('All fields are required. Please fill in every column before saving.');
      return;
    }
    const now = new Date().toLocaleString();
    const student: Student = {
      id: `${Date.now()}_new`,
      studentName: d.studentName.trim(),
      assignedDay: d.assignedDay,
      assignedTeacher: d.assignedTeacher.trim(),
      subject: d.subject,
      currentLevel: d.currentLevel.trim(),
      currentWeek: d.currentWeek.trim(),
      modifiedAt: now,
    };
    this.dataService.addStudent(student);
    this.logService.log('ADD', `Student "${student.studentName}" | Day: ${student.assignedDay} | Teacher: ${student.assignedTeacher} | Subject: ${student.subject} | Level: ${student.currentLevel} | Week: ${student.currentWeek}`);
    this.showNewRow.set(false);
    this.newRowDraft = this.blankDraft();
  }

  get isNewRowValid(): boolean {
    const d = this.newRowDraft;
    return !!(d.studentName.trim() && d.assignedDay && d.assignedTeacher.trim() && d.subject && d.currentLevel.trim() && d.currentWeek.trim());
  }

  startEdit(student: Student): void {
    this.cancelNewRow();
    this.cancelAddSubject();
    this.editingId.set(student.id);
    this.editDraft.set({ ...student });
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editDraft.set(null);
  }

  saveEdit(): void {
    const draft = this.editDraft();
    if (!draft) return;
    if (!draft.parentId && !draft.studentName.trim()) {
      alert('Student name cannot be empty.');
      return;
    }
    const now = new Date().toLocaleString();
    const updated = { ...draft, studentName: draft.parentId ? draft.studentName : draft.studentName.trim(), modifiedAt: now };
    this.dataService.updateStudent(updated);
    this.logService.log('EDIT', `${updated.parentId ? 'Subject entry' : 'Student'} "${updated.studentName}" | Day: ${updated.assignedDay} | Teacher: ${updated.assignedTeacher} | Subject: ${updated.subject} | Level: ${updated.currentLevel} | Week: ${updated.currentWeek}`);
    this.editingId.set(null);
    this.editDraft.set(null);
  }

  isEditing(id: string): boolean {
    return this.editingId() === id;
  }

  openAddSubject(student: Student): void {
    this.cancelEdit();
    this.cancelNewRow();
    this.addSubjectDraft = this.blankSubjectDraft();
    this.addSubjectForId.set(student.id);
  }

  cancelAddSubject(): void {
    this.addSubjectForId.set(null);
    this.addSubjectDraft = this.blankSubjectDraft();
  }

  saveAddSubject(parentStudent: Student): void {
    const d = this.addSubjectDraft;
    if (!d.assignedDay || !d.assignedTeacher.trim() || !d.subject || !d.currentLevel.trim() || !d.currentWeek.trim()) return;
    const now = new Date().toLocaleString();
    const entry: Student = {
      id: `${Date.now()}_sub`,
      parentId: parentStudent.id,
      studentName: parentStudent.studentName,
      assignedDay: d.assignedDay,
      assignedTeacher: d.assignedTeacher.trim(),
      subject: d.subject,
      currentLevel: d.currentLevel.trim(),
      currentWeek: d.currentWeek.trim(),
      modifiedAt: now,
    };
    this.dataService.addStudent(entry);
    this.logService.log('ADD SUBJECT', `Student "${parentStudent.studentName}" | Subject: ${entry.subject} | Day: ${entry.assignedDay} | Teacher: ${entry.assignedTeacher} | Level: ${entry.currentLevel} | Week: ${entry.currentWeek}`);
    this.cancelAddSubject();
  }

  get isAddSubjectValid(): boolean {
    const d = this.addSubjectDraft;
    return !!(d.assignedDay && d.assignedTeacher.trim() && d.subject && d.currentLevel.trim() && d.currentWeek.trim());
  }

  getSubjectEntries(studentId: string): Student[] {
    return this.dataService.students().filter(s => s.parentId === studentId);
  }

  getRowspan(student: Student): number {
    const entries = this.getSubjectEntries(student.id);
    const addOpen = this.addSubjectForId() === student.id;
    return 1 + entries.length + (addOpen ? 1 : 0);
  }

  availableSubjectsFor(studentId: string): string[] {
    const all = this.dataService.students();
    const primary = all.find(s => s.id === studentId);
    if (!primary) return SUBJECTS;
    const used = new Set<string>([primary.subject].filter(Boolean));
    all.filter(s => s.parentId === studentId).forEach(s => used.add(s.subject));
    return SUBJECTS.filter(s => !used.has(s));
  }

  availableSubjectsForEdit(entry: Student): string[] {
    if (!entry.parentId) return SUBJECTS;
    const all = this.dataService.students();
    const used = new Set<string>();
    const parent = all.find(s => s.id === entry.parentId);
    if (parent) used.add(parent.subject);
    all.filter(s => s.parentId === entry.parentId && s.id !== entry.id).forEach(s => used.add(s.subject));
    return SUBJECTS.filter(s => !used.has(s));
  }

  onDeleteClick(student: Student): void {
    const entries = student.parentId ? [] : this.getSubjectEntries(student.id);
    const confirmMsg = entries.length > 0
      ? `Delete "${student.studentName}" and ${entries.length} subject entr${entries.length === 1 ? 'y' : 'ies'}?`
      : student.parentId
        ? `Delete this ${student.subject} subject entry?`
        : `Delete "${student.studentName}"?`;
    if (!this.adminService.hasPassword()) {
      if (confirm(confirmMsg)) {
        this.doDelete(student);
      }
      return;
    }
    this.pendingDeleteId.set(student.id);
    this.pendingMode.set('delete');
    this.passwordError.set('');
    this.showPasswordDialog.set(true);
  }

  private doDelete(student: Student): void {
    const allStudents = this.dataService.students();
    const idx = allStudents.findIndex(s => s.id === student.id);
    const entries = student.parentId ? [] : allStudents.filter(e => e.parentId === student.id);
    const toDelete = [student, ...entries];
    const idsToRemove = new Set(toDelete.map(s => s.id));
    const label = entries.length > 0
      ? `Deleted "${student.studentName}" and ${entries.length} subject entr${entries.length === 1 ? 'y' : 'ies'}`
      : student.parentId
        ? `Deleted ${student.subject} subject entry`
        : `Deleted "${student.studentName}"`;
    this.undoStudents.set(toDelete);
    this.undoLabel.set(label);
    this.undoIndex.set(idx);
    this.dataService.setStudents(allStudents.filter(s => !idsToRemove.has(s.id)));
    if (this.undoTimer) clearTimeout(this.undoTimer);
    this.undoTimer = setTimeout(() => {
      this.undoStudents.set([]);
      this.undoIndex.set(-1);
    }, 8000);
  }

  undoDelete(): void {
    const toRestore = this.undoStudents();
    const idx = this.undoIndex();
    if (toRestore.length === 0) return;
    if (this.undoTimer) clearTimeout(this.undoTimer);
    const current = [...this.dataService.students()];
    const insertAt = Math.max(0, Math.min(idx, current.length));
    current.splice(insertAt, 0, ...toRestore);
    this.dataService.setStudents(current);
    this.undoStudents.set([]);
    this.undoIndex.set(-1);
  }

  dismissUndo(): void {
    if (this.undoTimer) clearTimeout(this.undoTimer);
    this.undoStudents.set([]);
    this.undoIndex.set(-1);
  }

  get filteredStudents(): Student[] {
    const text = this.filterText().toLowerCase();
    const subject = this.filterSubject();
    const day = this.filterDay();
    const all = this.dataService.students();
    return all.filter((s: Student) => {
      if (s.parentId) return false;
      const matchText = !text ||
        s.studentName.toLowerCase().includes(text) ||
        s.assignedTeacher.toLowerCase().includes(text) ||
        s.currentLevel.toLowerCase().includes(text);
      const matchDay = !day || s.assignedDay === day;
      const entries = all.filter(e => e.parentId === s.id);
      const matchSubject = !subject || s.subject === subject || entries.some(e => e.subject === subject);
      return matchText && matchDay && matchSubject;
    });
  }

  get primaryStudentCount(): number {
    return this.dataService.students().filter(s => !s.parentId).length;
  }

  get uniqueSubjects(): string[] {
    return [...new Set(this.dataService.students().map((s: Student) => s.subject).filter((v): v is string => !!v))].sort();
  }

  get uniqueDays(): string[] {
    const order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const days = [...new Set(this.dataService.students().map((s: Student) => s.assignedDay).filter((v): v is string => !!v))];
    return days.sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }

  onExportClick(): void {
    if (this.dataService.students().length === 0) {
      alert('No student data to export.');
      return;
    }
    if (!this.adminService.hasPassword()) {
      this.doExport();
      return;
    }
    this.pendingMode.set('export');
    this.passwordError.set('');
    this.showPasswordDialog.set(true);
  }

  onImportClick(): void {
    if (!this.adminService.hasPassword()) {
      this.triggerImportFilePicker();
      return;
    }
    this.pendingMode.set('import');
    this.passwordError.set('');
    this.showPasswordDialog.set(true);
  }

  onPasswordConfirmed(pwd: string): void {
    if (!this.adminService.verifyPassword(pwd)) {
      this.passwordError.set('Incorrect password. Please try again.');
      return;
    }
    this.showPasswordDialog.set(false);
    this.passwordError.set('');
    const mode = this.pendingMode();
    this.pendingMode.set(null);
    if (mode === 'export') {
      this.doExport();
    } else if (mode === 'import') {
      this.triggerImportFilePicker();
    } else if (mode === 'delete') {
      const id = this.pendingDeleteId();
      if (id) {
        const student = this.dataService.students().find(s => s.id === id);
        if (student) this.doDelete(student);
      }
      this.pendingDeleteId.set(null);
    }
  }

  onPasswordCancelled(): void {
    this.showPasswordDialog.set(false);
    this.passwordError.set('');
    this.pendingMode.set(null);
    this.pendingFile.set(null);
  }

  private doExport(): void {
    try {
      this.excelService.exportStudents(
        this.dataService.students(),
        this.adminService.getSettings().centerName,
      );
    } catch (err) {
      alert('Export failed: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  triggerImportFilePicker(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.style.position = 'fixed';
    input.style.top = '-9999px';
    input.style.left = '-9999px';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.onchange = (e: Event) => {
      document.body.removeChild(input);
      this.handleFileSelected(e);
    };
    input.click();
  }

  private async handleFileSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const students = await this.excelService.importStudents(file);
      this.ngZone.run(() => {
        if (students.length === 0) {
          alert('No student records found in the file. Ensure it contains data rows below the header.');
          return;
        }
        const confirmed = confirm(
          `Import ${students.length} student record(s)?\n\nThis will REPLACE all current data.`
        );
        if (confirmed) {
          this.dataService.setStudents(students);
          this.logService.log('IMPORT', `Imported ${students.length} record(s) from file "${file.name}"`);
          // Reset all in-progress editing state after import
          this.cancelEdit();
          this.cancelNewRow();
          this.cancelAddSubject();
          // Return keyboard focus to the window after file picker + confirm dialogs
          window.focus();
        }
      });
    } catch (err) {
      this.ngZone.run(() => {
        alert('Import failed: ' + (err instanceof Error ? err.message : String(err)));
      });
    }
  }

  ngOnDestroy(): void {
    if (this.undoTimer) clearTimeout(this.undoTimer);
  }

  formatTimestamp(ts?: string): string {
    return ts ?? '—';
  }
}
