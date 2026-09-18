import { z } from "zod";
import { env } from "cloudflare:workers";
import { verifyPassword, createSession } from "@/lib/auth";
const schema=z.object({email:z.string().trim().toLowerCase().email(),password:z.string().min(1).max(128)});
export async function POST(request:Request){
  try{
    const parsed=schema.safeParse(await request.json());if(!parsed.success)return Response.json({error:"Проверьте email и пароль"},{status:400});
    const db=(env as unknown as {DB:D1Database}).DB;const user=await db.prepare("SELECT id,name,email,password_hash AS passwordHash,password_salt AS passwordSalt FROM users WHERE email=?").bind(parsed.data.email).first<{id:string;name:string;email:string;passwordHash:string;passwordSalt:string}>();
    if(!user||!await verifyPassword(parsed.data.password,user.passwordSalt,user.passwordHash))return Response.json({error:"Неверный email или пароль"},{status:401});
    return Response.json({user:{id:user.id,name:user.name,email:user.email}},{headers:{"Set-Cookie":await createSession(user.id,request)}});
  }catch(error){console.error("Login failed",error);return Response.json({error:"Не удалось войти"},{status:500});}
}
