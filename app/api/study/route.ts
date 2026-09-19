import { z } from "zod";
import { env } from "cloudflare:workers";
import { getUser } from "@/lib/auth";
import { COLORS, ICONS, normalizeUrl } from "@/lib/study";

function database(){const db=(env as unknown as {DB?:D1Database}).DB;if(!db)throw new Error("Database unavailable");return db;}
function fileStore(){return (env as unknown as {FILES?:R2Bucket}).FILES;}
const templates=[["lesson","Ссылка на урок","Подключение к занятию"],["course","Ссылка на курс","Программа и задания"],["materials","Материалы","Конспекты и файлы"]] as const;
async function readData(db:D1Database,userId:string){
  const [subjects,resources,lessons,notes,tasks,attachments,layouts]=await db.batch([
    db.prepare("SELECT id,name,color,icon,position FROM subjects WHERE owner_id=? ORDER BY position,name").bind(userId),
    db.prepare("SELECT r.id,r.subject_id AS subjectId,r.title,r.description,r.kind,r.url,r.position FROM resources r JOIN subjects s ON s.id=r.subject_id WHERE s.owner_id=? ORDER BY r.position,r.id").bind(userId),
    db.prepare("SELECT l.id,l.subject_id AS subjectId,l.date,l.start,l.end,l.kind,l.repeat,l.url FROM lessons l JOIN subjects s ON s.id=l.subject_id WHERE s.owner_id=? ORDER BY l.date,l.start").bind(userId),
    db.prepare("SELECT n.subject_id AS subjectId,n.content,n.updated_at AS updatedAt FROM subject_notes n JOIN subjects s ON s.id=n.subject_id WHERE s.owner_id=?").bind(userId),
    db.prepare("SELECT t.id,t.subject_id AS subjectId,t.title,t.completed,t.position,t.created_at AS createdAt FROM tasks t JOIN subjects s ON s.id=t.subject_id WHERE s.owner_id=? ORDER BY t.completed,t.position,t.created_at").bind(userId),
    db.prepare("SELECT a.id,a.subject_id AS subjectId,a.name,a.type,a.size,a.uploaded_at AS uploadedAt FROM attachments a JOIN subjects s ON s.id=a.subject_id WHERE s.owner_id=? ORDER BY a.uploaded_at DESC").bind(userId),
    db.prepare("SELECT l.subject_id AS subjectId,l.section_order AS 'order' FROM subject_layouts l JOIN subjects s ON s.id=l.subject_id WHERE s.owner_id=?").bind(userId),
  ]);return {subjects:subjects.results,resources:resources.results,lessons:lessons.results,notes:notes.results,tasks:tasks.results,attachments:attachments.results,layouts:layouts.results};
}
async function ownsSubject(db:D1Database,userId:string,subjectId:string){return !!await db.prepare("SELECT id FROM subjects WHERE id=? AND owner_id=?").bind(subjectId,userId).first();}
async function ownsChild(db:D1Database,userId:string,table:"resources"|"lessons"|"tasks",id:string){return !!await db.prepare(`SELECT x.id FROM ${table} x JOIN subjects s ON s.id=x.subject_id WHERE x.id=? AND s.owner_id=?`).bind(id,userId).first();}
const id=z.string().min(1).max(100);
const url=z.string().max(3000).transform((value,ctx)=>{try{return normalizeUrl(value)}catch{ctx.addIssue({code:"custom",message:"Некорректная ссылка"});return z.NEVER;}});
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,"Некорректная дата");
const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const actionSchema=z.discriminatedUnion("action",[
  z.object({action:z.literal("saveSubject"),id:id.optional(),name:z.string().trim().min(1,"Введите название").max(100),color:z.enum(COLORS),icon:z.enum(ICONS)}),z.object({action:z.literal("deleteSubject"),id}),
  z.object({action:z.literal("saveResource"),id:id.optional(),subjectId:id,title:z.string().trim().min(1).max(100),description:z.string().trim().max(180),kind:z.enum(["lesson","course","materials","other"]),url}),z.object({action:z.literal("deleteResource"),id}),
  z.object({action:z.literal("saveLesson"),id:id.optional(),subjectId:id,date,start:time,end:time,kind:z.enum(["Урок","Лекция","Практика","Лабораторная","Семинар","Другое"]),repeat:z.union([z.literal(0),z.literal(1)]),url}),z.object({action:z.literal("deleteLesson"),id}),
  z.object({action:z.literal("saveNote"),subjectId:id,content:z.string().max(12000)}),z.object({action:z.literal("saveTask"),subjectId:id,title:z.string().trim().min(1,"Введите название задачи").max(240)}),z.object({action:z.literal("toggleTask"),id,completed:z.union([z.literal(0),z.literal(1)])}),z.object({action:z.literal("deleteTask"),id}),
  z.object({action:z.literal("saveSectionOrder"),subjectId:id,order:z.array(z.enum(["links","notes","tasks","files"])).length(4).refine(v=>new Set(v).size===4)}),
]);
const headers={"Cache-Control":"no-store"};
export async function GET(request:Request){try{const user=await getUser(request);if(!user)return Response.json({error:"Требуется вход"},{status:401,headers});return Response.json(await readData(database(),user.id),{headers});}catch(error){console.error("Study load failed",error);return Response.json({error:"Не удалось загрузить данные. Попробуйте ещё раз."},{status:503,headers});}}
export async function POST(request:Request){
  const origin=request.headers.get("origin");
  const publicHost=(request.headers.get("x-forwarded-host")||request.headers.get("host")||"").split(",")[0].trim();
  if(origin){
    let originHost="";
    try{originHost=new URL(origin).host;}catch{return Response.json({error:"Недопустимый запрос"},{status:403});}
    if(!publicHost||originHost!==publicHost)return Response.json({error:"Недопустимый запрос"},{status:403});
  }
  try{
    const user=await getUser(request);if(!user)return Response.json({error:"Требуется вход"},{status:401,headers});
    const raw=await request.text();if(raw.length>15000)return Response.json({error:"Слишком много данных"},{status:413});let json;try{json=JSON.parse(raw)}catch{return Response.json({error:"Некорректный запрос"},{status:400});}
    const parsed=actionSchema.safeParse(json);if(!parsed.success)return Response.json({error:parsed.error.issues[0].message},{status:400});const a=parsed.data;const db=database();const resultId="id" in a&&a.id?a.id:crypto.randomUUID();
    if("subjectId" in a&&!await ownsSubject(db,user.id,a.subjectId))return Response.json({error:"Дисциплина не найдена"},{status:404});
    if("id" in a&&a.id){const owned=a.action.endsWith("Subject")?await ownsSubject(db,user.id,a.id):a.action.endsWith("Resource")?await ownsChild(db,user.id,"resources",a.id):a.action.endsWith("Task")?await ownsChild(db,user.id,"tasks",a.id):await ownsChild(db,user.id,"lessons",a.id);if(!owned)return Response.json({error:"Запись не найдена"},{status:404});}
    switch(a.action){
      case "saveSubject":if(a.id)await db.prepare("UPDATE subjects SET name=?,color=?,icon=? WHERE id=? AND owner_id=?").bind(a.name,a.color,a.icon,a.id,user.id).run();else await db.batch([db.prepare("INSERT INTO subjects (id,name,color,icon,owner_id,position) VALUES (?,?,?,?,?,(SELECT COALESCE(MAX(position),0)+1 FROM subjects WHERE owner_id=?))").bind(resultId,a.name,a.color,a.icon,user.id,user.id),...templates.map(([kind,title,description],i)=>db.prepare("INSERT INTO resources (id,subject_id,title,description,kind,url,position) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),resultId,title,description,kind,"",i))]);break;
      case "deleteSubject":{const stored=await db.prepare("SELECT object_key AS objectKey FROM attachments WHERE subject_id=?").bind(a.id).all<{objectKey:string}>();const keys=stored.results.map(item=>item.objectKey);if(keys.length&&fileStore())await fileStore()!.delete(keys);await db.batch([db.prepare("DELETE FROM attachments WHERE subject_id=?").bind(a.id),db.prepare("DELETE FROM subject_layouts WHERE subject_id=?").bind(a.id),db.prepare("DELETE FROM tasks WHERE subject_id=?").bind(a.id),db.prepare("DELETE FROM subject_notes WHERE subject_id=?").bind(a.id),db.prepare("DELETE FROM lessons WHERE subject_id=?").bind(a.id),db.prepare("DELETE FROM resources WHERE subject_id=?").bind(a.id),db.prepare("DELETE FROM subjects WHERE id=? AND owner_id=?").bind(a.id,user.id)]);break;}
      case "saveResource":if(a.id)await db.prepare("UPDATE resources SET title=?,description=?,kind=?,url=? WHERE id=? AND subject_id=?").bind(a.title,a.description,a.kind,a.url,a.id,a.subjectId).run();else await db.prepare("INSERT INTO resources (id,subject_id,title,description,kind,url,position) VALUES (?,?,?,?,?,?,(SELECT COALESCE(MAX(position),0)+1 FROM resources WHERE subject_id=?))").bind(resultId,a.subjectId,a.title,a.description,a.kind,a.url,a.subjectId).run();break;
      case "deleteResource":await db.prepare("DELETE FROM resources WHERE id=?").bind(a.id).run();break;
      case "saveLesson":if(a.end<=a.start)return Response.json({error:"Занятие должно заканчиваться позже, чем начинается."},{status:400});if(a.id)await db.prepare("UPDATE lessons SET subject_id=?,date=?,start=?,end=?,kind=?,repeat=?,url=? WHERE id=?").bind(a.subjectId,a.date,a.start,a.end,a.kind,a.repeat,a.url,a.id).run();else await db.prepare("INSERT INTO lessons (id,subject_id,date,start,end,kind,repeat,url) VALUES (?,?,?,?,?,?,?,?)").bind(resultId,a.subjectId,a.date,a.start,a.end,a.kind,a.repeat,a.url).run();break;
      case "deleteLesson":await db.prepare("DELETE FROM lessons WHERE id=?").bind(a.id).run();break;
      case "saveNote":await db.prepare("INSERT INTO subject_notes (subject_id,content,updated_at) VALUES (?,?,?) ON CONFLICT(subject_id) DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at").bind(a.subjectId,a.content,new Date().toISOString()).run();break;
      case "saveTask":await db.prepare("INSERT INTO tasks (id,subject_id,title,completed,position,created_at) VALUES (?,?,?,0,(SELECT COALESCE(MAX(position),0)+1 FROM tasks WHERE subject_id=?),?)").bind(resultId,a.subjectId,a.title,a.subjectId,new Date().toISOString()).run();break;
      case "toggleTask":await db.prepare("UPDATE tasks SET completed=? WHERE id=?").bind(a.completed,a.id).run();break;
      case "deleteTask":await db.prepare("DELETE FROM tasks WHERE id=?").bind(a.id).run();break;
      case "saveSectionOrder":await db.prepare("INSERT INTO subject_layouts (subject_id,section_order) VALUES (?,?) ON CONFLICT(subject_id) DO UPDATE SET section_order=excluded.section_order").bind(a.subjectId,JSON.stringify(a.order)).run();break;
    }
    return Response.json({...(await readData(db,user.id)),savedId:resultId},{headers});
  }catch(error){console.error("Study save failed",error);return Response.json({error:"Не удалось сохранить изменения. Попробуйте ещё раз."},{status:503,headers});}
}
