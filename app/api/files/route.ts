import { env } from "cloudflare:workers";
import { getUser } from "@/lib/auth";

type Bindings={DB:D1Database;FILES:R2Bucket};
function bindings(){return env as unknown as Bindings;}
async function owned(db:D1Database,userId:string,subjectId:string){return !!await db.prepare("SELECT id FROM subjects WHERE id=? AND owner_id=?").bind(subjectId,userId).first();}
const blocked=new Set(["text/html","image/svg+xml","application/javascript","text/javascript","application/x-msdownload","application/x-sh"]);
function validOrigin(request:Request){const origin=request.headers.get("origin");if(!origin)return true;const host=(request.headers.get("x-forwarded-host")||request.headers.get("host")||"").split(",")[0].trim();try{return Boolean(host)&&new URL(origin).host===host;}catch{return false;}}

export async function POST(request:Request){
  try{
    if(!validOrigin(request))return Response.json({error:"Недопустимый запрос"},{status:403});
    const user=await getUser(request);if(!user)return Response.json({error:"Требуется вход"},{status:401});
    const form=await request.formData();const subjectId=String(form.get("subjectId")||"");const file=form.get("file");
    if(!subjectId||!(file instanceof File))return Response.json({error:"Выберите файл"},{status:400});
    const {DB,FILES}=bindings();if(!await owned(DB,user.id,subjectId))return Response.json({error:"Дисциплина не найдена"},{status:404});
    if(file.size>10*1024*1024)return Response.json({error:"Файл должен быть не больше 10 МБ"},{status:413});
    if(!file.size)return Response.json({error:"Файл пустой"},{status:400});
    const type=file.type||"application/octet-stream";if(blocked.has(type))return Response.json({error:"Этот тип файла нельзя загружать"},{status:415});
    const id=crypto.randomUUID();const key=`${user.id}/${subjectId}/${id}`;await FILES.put(key,file.stream(),{httpMetadata:{contentType:type}});
    await DB.prepare("INSERT INTO attachments (id,subject_id,name,type,size,object_key,uploaded_at) VALUES (?,?,?,?,?,?,?)").bind(id,subjectId,file.name.slice(0,240),type,file.size,key,new Date().toISOString()).run();
    return Response.json({ok:true});
  }catch(error){console.error("File upload failed",error);return Response.json({error:"Не удалось загрузить файл"},{status:500});}
}
export async function GET(request:Request){
  const user=await getUser(request);if(!user)return new Response("Требуется вход",{status:401});const id=new URL(request.url).searchParams.get("id");if(!id)return new Response("Файл не указан",{status:400});
  const {DB,FILES}=bindings();const row=await DB.prepare("SELECT a.name,a.type,a.object_key AS objectKey FROM attachments a JOIN subjects s ON s.id=a.subject_id WHERE a.id=? AND s.owner_id=?").bind(id,user.id).first<{name:string;type:string;objectKey:string}>();if(!row)return new Response("Файл не найден",{status:404});
  const object=await FILES.get(row.objectKey);if(!object)return new Response("Файл не найден",{status:404});const safe=row.name.replace(/[\r\n"\\]/g,"_");return new Response(object.body,{headers:{"Content-Type":row.type,"Content-Disposition":`attachment; filename*=UTF-8''${encodeURIComponent(safe)}`,"X-Content-Type-Options":"nosniff"}});
}
export async function DELETE(request:Request){
  if(!validOrigin(request))return Response.json({error:"Недопустимый запрос"},{status:403});
  const user=await getUser(request);if(!user)return Response.json({error:"Требуется вход"},{status:401});const id=new URL(request.url).searchParams.get("id");if(!id)return Response.json({error:"Файл не указан"},{status:400});
  const {DB,FILES}=bindings();const row=await DB.prepare("SELECT a.object_key AS objectKey FROM attachments a JOIN subjects s ON s.id=a.subject_id WHERE a.id=? AND s.owner_id=?").bind(id,user.id).first<{objectKey:string}>();if(!row)return Response.json({error:"Файл не найден"},{status:404});await FILES.delete(row.objectKey);await DB.prepare("DELETE FROM attachments WHERE id=?").bind(id).run();return Response.json({ok:true});
}
