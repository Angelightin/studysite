import { env } from "cloudflare:workers";

export type AuthUser = { id: string; name: string; email: string };
const COOKIE = "study_session";
const DAYS = 30;

function db() {
  const value=(env as unknown as {DB?:D1Database}).DB;
  if(!value) throw new Error("Database unavailable");
  return value;
}

function bytesToBase64(bytes:Uint8Array) {
  let value=""; for(const byte of bytes)value+=String.fromCharCode(byte);
  return btoa(value);
}
function base64ToBytes(value:string) {
  const decoded=atob(value); return Uint8Array.from(decoded,c=>c.charCodeAt(0));
}
function randomToken(size=32) {const bytes=new Uint8Array(size);crypto.getRandomValues(bytes);return bytesToBase64(bytes).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");}
async function digest(value:string) {const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return bytesToBase64(new Uint8Array(bytes));}

export async function hashPassword(password:string,saltValue?:string) {
  const salt=saltValue?base64ToBytes(saltValue):crypto.getRandomValues(new Uint8Array(16));
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations:210000},key,256);
  return {hash:bytesToBase64(new Uint8Array(bits)),salt:bytesToBase64(salt)};
}
export async function verifyPassword(password:string,salt:string,expected:string) {
  const {hash}=await hashPassword(password,salt);
  if(hash.length!==expected.length)return false;
  let difference=0;for(let i=0;i<hash.length;i++)difference|=hash.charCodeAt(i)^expected.charCodeAt(i);
  return difference===0;
}
function readCookie(request:Request) {
  const header=request.headers.get("cookie")||"";
  for(const part of header.split(";")){const [name,...rest]=part.trim().split("=");if(name===COOKIE)return decodeURIComponent(rest.join("="));}
  return null;
}
export async function getUser(request:Request):Promise<AuthUser|null> {
  const token=readCookie(request);if(!token)return null;
  const row=await db().prepare("SELECT u.id,u.name,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?").bind(await digest(token),new Date().toISOString()).first<AuthUser>();
  return row||null;
}
export async function createSession(userId:string,request?:Request) {
  const token=randomToken();const now=new Date();const expires=new Date(now.getTime()+DAYS*86400000);
  await db().batch([
    db().prepare("DELETE FROM sessions WHERE expires_at<=?").bind(now.toISOString()),
    db().prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),userId,await digest(token),expires.toISOString(),now.toISOString()),
  ]);
  const secure=request&&new URL(request.url).protocol==="https:"?"; Secure":"";
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DAYS*86400}${secure}`;
}
export async function destroySession(request:Request) {
  const token=readCookie(request);if(token)await db().prepare("DELETE FROM sessions WHERE token_hash=?").bind(await digest(token)).run();
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
