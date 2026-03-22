import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { Student } from '../models/student.model';

const EXPECTED_HEADERS = [
  'Student Name',
  'Assigned Day',
  'Assigned Teacher',
  'Subject',
  'Current Level',
  'Current Week',
];

@Injectable({ providedIn: 'root' })
export class ExcelService {

  importStudents(file: File): Promise<Student[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        try {
          const buffer = e.target!.result as ArrayBuffer;
          const data = new Uint8Array(buffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          if (!sheetName) {
            reject(new Error('No sheets found in the Excel file.'));
            return;
          }
          const worksheet = workbook.Sheets[sheetName];
          const rows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (rows.length < 2) {
            resolve([]);
            return;
          }

          const students: Student[] = [];
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i] as string[];
            const name = (row[0] ?? '').toString().trim();
            if (!name) continue;
            students.push({
              id: `${Date.now()}_${i}`,
              studentName: name,
              assignedDay: (row[1] ?? '').toString().trim(),
              assignedTeacher: (row[2] ?? '').toString().trim(),
              subject: (row[3] ?? '').toString().trim(),
              currentLevel: (row[4] ?? '').toString().trim(),
              currentWeek: (row[5] ?? '').toString().trim(),
            });
          }
          resolve(students);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read the file.'));
      reader.readAsArrayBuffer(file);
    });
  }

  exportStudents(students: Student[], centerName: string): void {
    const worksheetData: (string | number)[][] = [
      EXPECTED_HEADERS,
      ...students.map(s => [
        s.studentName,
        s.assignedDay,
        s.assignedTeacher,
        s.subject,
        s.currentLevel,
        s.currentWeek,
      ]),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Auto-width columns
    const colWidths = EXPECTED_HEADERS.map((h, i) => ({
      wch: Math.max(
        h.length,
        ...students.map(s => {
          const vals = [s.studentName, s.assignedDay, s.assignedTeacher, s.subject, s.currentLevel, s.currentWeek];
          return (vals[i] ?? '').toString().length;
        })
      ) + 2,
    }));
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');

    const safeName = centerName.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'StudentBooklet';
    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `${safeName}_${date}.xlsx`);
  }
}
