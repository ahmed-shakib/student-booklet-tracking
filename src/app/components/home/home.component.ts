import { Component, inject, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { AdminService } from '../../services/admin.service';
import { ExcelService } from '../../services/excel.service';
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

  readonly allDays = DAYS;
  readonly allSubjects = SUBJECTS;

  showPasswordDialog = signal(false);
  passwordError = signal('');
  pendingMode = signal<DialogMode>(null);
  pendingFile = signal<File | null>(null);
  pendingDeleteId = signal<string | null>(null);

  // Undo delete state
  undoStudent = signal<Student | null>(null);
  undoIndex = signal<number>(-1);
  private undoTimer: ReturnType<typeof setTimeout> | null = null;

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
    this.newRowDraft = this.blankDraft();
    this.showNewRow.set(true);
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
    const student: Student = {
      id: `${Date.now()}_new`,
      studentName: d.studentName.trim(),
      assignedDay: d.assignedDay,
      assignedTeacher: d.assignedTeacher.trim(),
      subject: d.subject,
      currentLevel: d.currentLevel.trim(),
      currentWeek: d.currentWeek.trim(),
    };
    this.dataService.addStudent(student);
    this.showNewRow.set(false);
    this.newRowDraft = this.blankDraft();
  }

  get isNewRowValid(): boolean {
    const d = this.newRowDraft;
    return !!(d.studentName.trim() && d.assignedDay && d.assignedTeacher.trim() && d.subject && d.currentLevel.trim() && d.currentWeek.trim());
  }

  startEdit(student: Student): void {
    this.cancelNewRow();
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
    if (!draft.studentName.trim()) {
      alert('Student name cannot be empty.');
      return;
    }
    this.dataService.updateStudent({ ...draft, studentName: draft.studentName.trim() });
    this.editingId.set(null);
    this.editDraft.set(null);
  }

  isEditing(id: string): boolean {
    return this.editingId() === id;
  }

  onDeleteClick(student: Student): void {
    if (!this.adminService.hasPassword()) {
      if (confirm(`Delete "${student.studentName}"?`)) {
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
    this.undoStudent.set(student);
    this.undoIndex.set(idx);
    this.dataService.deleteStudent(student.id);
    if (this.undoTimer) clearTimeout(this.undoTimer);
    this.undoTimer = setTimeout(() => {
      this.undoStudent.set(null);
      this.undoIndex.set(-1);
    }, 8000);
  }

  undoDelete(): void {
    const student = this.undoStudent();
    const idx = this.undoIndex();
    if (!student) return;
    if (this.undoTimer) clearTimeout(this.undoTimer);
    const students = [...this.dataService.students()];
    const insertAt = Math.max(0, Math.min(idx, students.length));
    students.splice(insertAt, 0, student);
    this.dataService.setStudents(students);
    this.undoStudent.set(null);
    this.undoIndex.set(-1);
  }

  dismissUndo(): void {
    if (this.undoTimer) clearTimeout(this.undoTimer);
    this.undoStudent.set(null);
    this.undoIndex.set(-1);
  }

  get filteredStudents(): Student[] {
    const text = this.filterText().toLowerCase();
    const subject = this.filterSubject();
    const day = this.filterDay();
    return this.dataService.students().filter((s: Student) => {
      const matchText = !text ||
        s.studentName.toLowerCase().includes(text) ||
        s.assignedTeacher.toLowerCase().includes(text) ||
        s.currentLevel.toLowerCase().includes(text);
      const matchSubject = !subject || s.subject === subject;
      const matchDay = !day || s.assignedDay === day;
      return matchText && matchSubject && matchDay;
    });
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
    input.onchange = (e: Event) => this.handleFileSelected(e);
    input.click();
  }

  private async handleFileSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const students = await this.excelService.importStudents(file);
      if (students.length === 0) {
        alert('No student records found in the file. Ensure it contains data rows below the header.');
        return;
      }
      const confirmed = confirm(
        `Import ${students.length} student record(s)?\n\nThis will REPLACE all current data.`
      );
      if (confirmed) {
        this.dataService.setStudents(students);
      }
    } catch (err) {
      alert('Import failed: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  ngOnDestroy(): void {
    if (this.undoTimer) clearTimeout(this.undoTimer);
  }
}
