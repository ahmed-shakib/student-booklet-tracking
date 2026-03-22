export interface Student {
  id: string;
  parentId?: string;
  studentName: string;
  assignedDay: string;
  assignedTeacher: string;
  subject: string;
  currentLevel: string;
  currentWeek: string;
  modifiedAt?: string;
}
