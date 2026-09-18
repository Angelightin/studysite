import { z } from "zod";
import { env } from "cloudflare:workers";
import { hashPassword, createSession } from "@/lib/auth";
import { cloneTemplate } from "@/lib/template-data";

const schema=z.object({name:z.string().trim().min(2,"Введите имя").max(80),email:z.string().trim().toLowerCase().email("Введите корректный email").max(254),password:z.string().min(8,"Пароль должен содержать минимум 8 символов").max(128)});
export async function POST(request:Request){
  try{
    const parsed=schema.safeParse(await request.json());if(!parsed.success)return Response.json({error:parsed.error.issues[0].message},{status:400});
    const db=(env as unknown as {DB:D1Database}).DB;const {name,email,password}=parsed.data;
    if(await db.prepare("SELECT id FROM users WHERE email=?").bind(email).first())return Response.json({error:"Аккаунт с таким email уже существует"},{status:409});
    const id=crypto.randomUUID();const passwordData=await hashPassword(password);
    await db.prepare("INSERT INTO users (id,name,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?,?)").bind(id,name,email,passwordData.hash,passwordData.salt,new Date().toISOString()).run();
    try{await cloneTemplate(db,id);}catch(error){await db.prepare("DELETE FROM users WHERE id=?").bind(id).run();throw error;}
    return Response.json({user:{id,name,email}},{headers:{"Set-Cookie":await createSession(id,request)}});
  }catch(error){console.error("Registration failed",error);return Response.json({error:"Не удалось создать аккаунт"},{status:500});}
}
