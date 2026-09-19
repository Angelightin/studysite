export type Subject = { id: string; name: string; color: string; icon: string; position: number };
export type Resource = { id: string; subjectId: string; title: string; description: string; kind: string; url: string; position: number };
export type Lesson = { id: string; subjectId: string; date: string; start: string; end: string; kind: string; repeat: number; url: string };
export type SubjectNote = { subjectId: string; content: string; updatedAt: string };
export type Task = { id: string; subjectId: string; title: string; completed: number; position: number; createdAt: string };
export type Attachment = { id:string; subjectId:string; name:string; type:string; size:number; uploadedAt:string };
export type SubjectLayout = { subjectId:string; order:string };
export type StudyData = { subjects: Subject[]; resources: Resource[]; lessons: Lesson[]; notes: SubjectNote[]; tasks: Task[]; attachments:Attachment[]; layouts:SubjectLayout[] };
export const COLORS = ["green", "purple", "blue", "peach", "yellow", "slate"] as const;
export const ICONS = ["code", "integral", "matrix", "network", "atom", "language"] as const;
export const SLOTS = [["09:00", "10:30"], ["10:40", "12:10"], ["12:40", "14:10"], ["14:20", "15:50"], ["16:00", "17:30"]];
export const DAYS = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];
export function dateKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
export function parseDay(s: string) { return new Date(s + "T12:00:00"); }
export function addDays(d: Date, n: number) { const c = new Date(d); c.setDate(c.getDate()+n); return c; }
export function monday(d: Date) { return addDays(d, -((d.getDay()+6)%7)); }
export function occursOn(l: Lesson, d: Date) { const key=dateKey(d); return l.repeat ? key>=l.date && parseDay(l.date).getDay()===d.getDay() : key===l.date; }
export function linkCount(n: number) { return n%10===1 && n%100!==11 ? `${n} ссылка` : n%10>=2 && n%10<=4 && (n%100<12 || n%100>14) ? `${n} ссылки` : `${n} ссылок`; }
export function normalizeUrl(value: string) {
  const v=value.trim(); if (!v) return "";
  const u=new URL(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`);
  if (!["https:", "http:"].includes(u.protocol) || !u.hostname || u.username || u.password) throw new Error("Укажите обычную ссылку, начинающуюся с https://");
  return u.href;
}
