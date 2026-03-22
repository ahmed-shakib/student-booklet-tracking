import { Injectable, signal } from '@angular/core';
import { Student } from '../models/student.model';

@Injectable({ providedIn: 'root' })
export class DataService {
  private readonly storageKey = 'sbt_students';

  private _students = signal<Student[]>(this.loadStudents());
  readonly students = this._students.asReadonly();

  private loadStudents(): Student[] {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  getStudents(): Student[] {
    return this._students();
  }

  setStudents(students: Student[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(students));
    this._students.set(students);
  }

  addStudent(student: Student): void {
    const current = this._students();
    this.setStudents([...current, student]);
  }

  updateStudent(updated: Student): void {
    const updated_list = this._students().map(s => s.id === updated.id ? updated : s);
    this.setStudents(updated_list);
  }

  deleteStudent(id: string): void {
    this.setStudents(this._students().filter(s => s.id !== id));
  }
}
