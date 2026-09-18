import { z } from "zod";
import { env } from "cloudflare:workers";
import { COLORS, ICONS, SLOTS, dateKey, monday, addDays, normalizeUrl } from "@/lib/study";
function database() {
  const db=(env as unknown as {DB?: D1Database}).DB;
  if (!db) throw new Error("Database unavailable");
  return db;
}
const templates = [
  ["lesson", "Ссылка на урок", "Подключение к занятию"],
  ["course", "Ссылка на курс", "Программа и задания"],
  ["materials", "Материалы", "Конспекты и файлы"],
];
async function seed(db: D1Database) {
  if (await db.prepare("SELECT value FROM settings WHERE key = ?").bind("initialized").first()) return;
  const names=["Программирование", "Математический анализ", "Линейная алгебра", "Дискретная математика", "Физика", "Английский язык"];
  const statements=[];
  for (let i=0;i<names.length;i++) {
    statements.push(db.prepare("INSERT OR IGNORE INTO subjects (id,name,color,icon,position) VALUES (?,?,?,?,?)").bind(`subject-${i}`,names[i],COLORS[i],ICONS[i],i));
    templates.forEach(([kind,title,desc],j)=>statements.push(db.prepare("INSERT OR IGNORE INTO resources (id,subject_id,title,description,kind,url,position) VALUES (?,?,?,?,?,?,?)").bind(`resource-${i}-${j}`,`subject-${i}`,title,desc,kind,"",j)));
  }
  const start=monday(new Date());
  const sample=[[0,0,1,"Лекция"],[0,1,0,"Практика"],[0,3,5,"Практика"],[1,1,4,"Лекция"],[1,2,2,"Практика"],[2,0,3,"Лекция"],[2,2,0,"Практика"],[3,0,1,"Практика"],[3,1,0,"Практика"],[3,3,4,"Лабораторная"],[4,1,2,"Лекция"],[4,2,5,"Практика"]] as const;
  sample.forEach(([day,slot,sub,kind],i)=>statements.push(db.prepare("INSERT OR IGNORE INTO lessons (id,subject_id,date,start,end,kind,repeat,url) VALUES (?,?,?,?,?,?,?,?)").bind(`lesson-${i}`,`subject-${sub}`,dateKey(addDays(start,day)),SLOTS[slot][0],SLOTS[slot][1],kind,1,"")));
  statements.push(db.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)").bind("initialized","1"));
  await db.batch(statements);
}
async function readData(db: D1Database) {
  const [subjects,resources,lessons,notes,tasks]=await db.batch([
    db.prepare("SELECT * FROM subjects ORDER BY position, name"),
    db.prepare("SELECT id,subject_id AS subjectId,title,description,kind,url,position FROM resources ORDER BY position, id"),
    db.prepare("SELECT id,subject_id AS subjectId,date,start,end,kind,repeat,url FROM lessons ORDER BY date,start"),
    db.prepare("SELECT subject_id AS subjectId,content,updated_at AS updatedAt FROM subject_notes"),
    db.prepare("SELECT id,subject_id AS subjectId,title,completed,position,created_at AS createdAt FROM tasks ORDER BY completed,position,created_at"),
  ]);
  return {subjects:subjects.results, resources:resources.results, lessons:lessons.results, notes:notes.results, tasks:tasks.results};
}
const id=z.string().min(1).max(100);
const url=z.string().max(3000).transform((value,ctx)=>{try {return normalizeUrl(value)} catch {ctx.addIssue({code:"custom",message:"Некорректная ссылка"}); return z.NEVER;}});
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v,"Некорректная дата");
const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const actionSchema=z.discriminatedUnion("action",[
  z.object({action:z.literal("saveSubject"), id:id.optional(), name:z.string().trim().min(1,"Введите название").max(100),color:z.enum(COLORS),icon:z.enum(ICONS)}),
  z.object({action:z.literal("deleteSubject"),id}),
  z.object({action:z.literal("saveResource"),id:id.optional(),subjectId:id,title:z.string().trim().min(1).max(100),description:z.string().trim().max(180),kind:z.enum(["lesson","course","materials","other"]),url}),
  z.object({action:z.literal("deleteResource"),id}),
  z.object({action:z.literal("saveLesson"),id:id.optional(),subjectId:id,date,start:time,end:time,kind:z.enum(["Лекция","Практика","Лабораторная","Семинар","Другое"]),repeat:z.union([z.literal(0),z.literal(1)]),url}),
  z.object({action:z.literal("deleteLesson"),id}),
  z.object({action:z.literal("saveNote"),subjectId:id,content:z.string().max(12000)}),
  z.object({action:z.literal("saveTask"),subjectId:id,title:z.string().trim().min(1,"Введите название задачи").max(240)}),
  z.object({action:z.literal("toggleTask"),id,completed:z.union([z.literal(0),z.literal(1)])}),
  z.object({action:z.literal("deleteTask"),id}),
]);
const headers={"Cache-Control":"no-store"};
export async function GET() {
  try {const db=database(); await seed(db); return Response.json(await readData(db),{headers});}
  catch(error) {console.error("Study load failed",error); return Response.json({error:"Не удалось загрузить данные. Попробуйте ещё раз."},{status:503,headers});}
}
export async function POST(request: Request) {
  if (request.headers.get("origin") && request.headers.get("origin")!==new URL(request.url).origin) return Response.json({error:"Недопустимый запрос"},{status:403});
  try {
    const raw=await request.text();
    if(raw.length>15000) return Response.json({error:"Слишком много данных"},{status:413});
    let json; try {json=JSON.parse(raw)} catch {return Response.json({error:"Некорректный запрос"},{status:400});}
    const parsed=actionSchema.safeParse(json);
    if(!parsed.success) return Response.json({error:parsed.error.issues[0].message},{status:400});
    const a=parsed.data; const db=database(); const resultId="id" in a && a.id ? a.id : crypto.randomUUID();
    if ("subjectId" in a && !(await db.prepare("SELECT id FROM subjects WHERE id=?").bind(a.subjectId).first())) return Response.json({error:"Дисциплина уже удалена. Обновите страницу."},{status:404});
    if("id" in a && a.id) {
      const table=a.action.endsWith("Subject") ? "subjects" : a.action.endsWith("Resource") ? "resources" : a.action.endsWith("Task") ? "tasks" : "lessons";
      if(!await db.prepare(`SELECT id FROM ${table} WHERE id=?`).bind(a.id).first()) return Response.json({error:"Запись уже удалена. Обновите страницу."},{status:404});
    }
    switch(a.action) {
      case "saveSubject":
        if(a.id) await db.prepare("UPDATE subjects SET name=?,color=?,icon=? WHERE id=?").bind(a.name,a.color,a.icon,a.id).run();
        else await db.batch([
          db.prepare("INSERT INTO subjects (id,name,color,icon,position) VALUES (?,?,?,?,(SELECT COALESCE(MAX(position),0)+1 FROM subjects))").bind(resultId,a.name,a.color,a.icon),
          ...templates.map(([kind,title,desc],i)=>db.prepare("INSERT INTO resources (id,subject_id,title,description,kind,url,position) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),resultId,title,desc,kind,"",i)),
        ]);
        break;
      case "deleteSubject":
        await db.batch([db.prepare("DELETE FROM tasks WHERE subject_id=?").bind(a.id),db.prepare("DELETE FROM subject_notes WHERE subject_id=?").bind(a.id),db.prepare("DELETE FROM lessons WHERE subject_id=?").bind(a.id),db.prepare("DELETE FROM resources WHERE subject_id=?").bind(a.id),db.prepare("DELETE FROM subjects WHERE id=?").bind(a.id)]); break;
      case "saveResource":
        if(a.id) await db.prepare("UPDATE resources SET title=?,description=?,kind=?,url=? WHERE id=? AND subject_id=?").bind(a.title,a.description,a.kind,a.url,a.id,a.subjectId).run();
        else await db.prepare("INSERT INTO resources (id,subject_id,title,description,kind,url,position) VALUES (?,?,?,?,?,?,(SELECT COALESCE(MAX(position),0)+1 FROM resources WHERE subject_id=?))").bind(resultId,a.subjectId,a.title,a.description,a.kind,a.url,a.subjectId).run();
        break;
      case "deleteResource": await db.prepare("DELETE FROM resources WHERE id=?").bind(a.id).run(); break;
      case "saveLesson":
        if(a.end<=a.start) return Response.json({error:"Занятие должно заканчиваться позже, чем начинается."},{status:400});
        if(a.id) await db.prepare("UPDATE lessons SET subject_id=?,date=?,start=?,end=?,kind=?,repeat=?,url=? WHERE id=?").bind(a.subjectId,a.date,a.start,a.end,a.kind,a.repeat,a.url,a.id).run();
        else await db.prepare("INSERT INTO lessons (id,subject_id,date,start,end,kind,repeat,url) VALUES (?,?,?,?,?,?,?,?)").bind(resultId,a.subjectId,a.date,a.start,a.end,a.kind,a.repeat,a.url).run();
        break;
      case "deleteLesson": await db.prepare("DELETE FROM lessons WHERE id=?").bind(a.id).run(); break;
      case "saveNote":
        await db.prepare("INSERT INTO subject_notes (subject_id,content,updated_at) VALUES (?,?,?) ON CONFLICT(subject_id) DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at").bind(a.subjectId,a.content,new Date().toISOString()).run(); break;
      case "saveTask":
        await db.prepare("INSERT INTO tasks (id,subject_id,title,completed,position,created_at) VALUES (?,?,?,0,(SELECT COALESCE(MAX(position),0)+1 FROM tasks WHERE subject_id=?),?)").bind(resultId,a.subjectId,a.title,a.subjectId,new Date().toISOString()).run(); break;
      case "toggleTask": await db.prepare("UPDATE tasks SET completed=? WHERE id=?").bind(a.completed,a.id).run(); break;
      case "deleteTask": await db.prepare("DELETE FROM tasks WHERE id=?").bind(a.id).run(); break;
    }
    return Response.json({...(await readData(db)),savedId:resultId},{headers});
  } catch(error) {console.error("Study save failed",error); return Response.json({error:"Не удалось сохранить изменения. Ваш ввод сохранён в форме — попробуйте ещё раз."},{status:503,headers});}
}
