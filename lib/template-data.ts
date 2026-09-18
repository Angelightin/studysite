import { COLORS, ICONS, SLOTS, dateKey, monday, addDays } from "@/lib/study";

const resourceTemplates = [
  ["lesson", "Ссылка на урок", "Подключение к занятию"],
  ["course", "Ссылка на курс", "Программа и задания"],
  ["materials", "Материалы", "Конспекты и файлы"],
] as const;
const names=["Программирование","Математический анализ","Линейная алгебра","Дискретная математика","Физика","Английский язык"];
const sample=[[0,0,1,"Лекция"],[0,1,0,"Практика"],[0,3,5,"Практика"],[1,1,4,"Лекция"],[1,2,2,"Практика"],[2,0,3,"Лекция"],[2,2,0,"Практика"],[3,0,1,"Практика"],[3,1,0,"Практика"],[3,3,4,"Лабораторная"],[4,1,2,"Лекция"],[4,2,5,"Практика"]] as const;

export async function ensureTemplate(db:D1Database) {
  const exists=await db.prepare("SELECT id FROM subjects WHERE owner_id IS NULL LIMIT 1").first();if(exists)return;
  const statements:D1PreparedStatement[]=[];
  for(let i=0;i<names.length;i++){
    statements.push(db.prepare("INSERT INTO subjects (id,name,color,icon,owner_id,position) VALUES (?,?,?,?,NULL,?)").bind(`template-subject-${i}`,names[i],COLORS[i],ICONS[i],i));
    resourceTemplates.forEach(([kind,title,description],j)=>statements.push(db.prepare("INSERT INTO resources (id,subject_id,title,description,kind,url,position) VALUES (?,?,?,?,?,?,?)").bind(`template-resource-${i}-${j}`,`template-subject-${i}`,title,description,kind,"",j)));
  }
  const start=monday(new Date());
  sample.forEach(([day,slot,subject,kind],i)=>statements.push(db.prepare("INSERT INTO lessons (id,subject_id,date,start,end,kind,repeat,url) VALUES (?,?,?,?,?,?,?,?)").bind(`template-lesson-${i}`,`template-subject-${subject}`,dateKey(addDays(start,day)),SLOTS[slot][0],SLOTS[slot][1],kind,1,"")));
  await db.batch(statements);
}

export async function cloneTemplate(db:D1Database,userId:string) {
  await ensureTemplate(db);
  const template=await db.prepare("SELECT id,name,color,icon,position FROM subjects WHERE owner_id IS NULL ORDER BY position").all<{id:string;name:string;color:string;icon:string;position:number}>();
  const statements:D1PreparedStatement[]=[];
  for(const subject of template.results){
    const newId=crypto.randomUUID();
    statements.push(db.prepare("INSERT INTO subjects (id,name,color,icon,owner_id,position) VALUES (?,?,?,?,?,?)").bind(newId,subject.name,subject.color,subject.icon,userId,subject.position));
    const resources=await db.prepare("SELECT title,description,kind,url,position FROM resources WHERE subject_id=?").bind(subject.id).all<{title:string;description:string;kind:string;url:string;position:number}>();
    resources.results.forEach(r=>statements.push(db.prepare("INSERT INTO resources (id,subject_id,title,description,kind,url,position) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),newId,r.title,r.description,r.kind,r.url,r.position)));
    const lessons=await db.prepare("SELECT date,start,end,kind,repeat,url FROM lessons WHERE subject_id=?").bind(subject.id).all<{date:string;start:string;end:string;kind:string;repeat:number;url:string}>();
    lessons.results.forEach(l=>statements.push(db.prepare("INSERT INTO lessons (id,subject_id,date,start,end,kind,repeat,url) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),newId,l.date,l.start,l.end,l.kind,l.repeat,l.url)));
  }
  if(statements.length)await db.batch(statements);
}
