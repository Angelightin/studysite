"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { BookOpen, Loader2 } from "lucide-react";

export default function AuthForm({mode}:{mode:"login"|"register"}){
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError("");const form=new FormData(event.currentTarget);const body={name:String(form.get("name")||""),email:String(form.get("email")||""),password:String(form.get("password")||"")};
    try{const response=await fetch(`/api/auth/${mode}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error||"Не удалось продолжить");window.location.href="/";}catch(value){setError(value instanceof Error?value.message:"Не удалось продолжить");setBusy(false);}}
  const register=mode==="register";
  return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><BookOpen/><span>Моя учёба</span></div><p className="eyebrow">Личное пространство</p><h1>{register?"Создать аккаунт":"С возвращением"}</h1><p className="auth-subtitle">{register?"Получите своё расписание, дисциплины и задачи":"Войдите, чтобы продолжить учёбу"}</p><form onSubmit={submit} className="auth-form">{register&&<label>Имя<input name="name" autoComplete="name" required minLength={2} maxLength={80} placeholder="Как к вам обращаться"/></label>}<label>Email<input name="email" type="email" autoComplete="email" required placeholder="name@example.com"/></label><label>Пароль<input name="password" type="password" autoComplete={register?"new-password":"current-password"} required minLength={register?8:1} maxLength={128} placeholder={register?"Минимум 8 символов":"Ваш пароль"}/></label>{error&&<p className="auth-error" role="alert">{error}</p>}<button className="btn primary auth-submit" disabled={busy}>{busy&&<Loader2 className="spin" size={18}/>} {register?"Зарегистрироваться":"Войти"}</button></form><p className="auth-switch">{register?"Уже есть аккаунт?":"Ещё нет аккаунта?"} <Link href={register?"/login":"/register"}>{register?"Войти":"Зарегистрироваться"}</Link></p></section></main>;
}
