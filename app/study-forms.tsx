"use client";

import { useState, type FormEvent } from "react";
import { BookOpen, CodeXml, Atom, Network, CaseSensitive, Grid2X2, Link2, Check, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { COLORS, ICONS, normalizeUrl, type Subject, type Resource, type Lesson } from "@/lib/study";

export type EditModal = {type:"subject"; item?:Subject} | {type:"resource"; subjectId:string; item?:Resource} | {type:"lesson"; item?:Lesson; date:string; start:string; end:string; subjectId:string};
export function SubjectIcon({name, size=34}: {name:string;size?:number}) {
  if(name==="integral") return <span className="integral-icon" style={{fontSize:size*1.35}} aria-hidden="true">∫</span>;
  if(name==="matrix") return <span className="matrix-icon" style={{fontSize:size*.43}} aria-hidden="true"><b>[</b><span>1 0<br/>0 1</span><b>]</b></span>;
  const Icon=({code:CodeXml,atom:Atom,network:Network,language:CaseSensitive} as Record<string,typeof CodeXml>)[name] || BookOpen;
  return <Icon size={size} strokeWidth={1.8} aria-hidden="true"/>;
}
export function Pick({value, onChange, options, label, id, className=""}: {value:string;onChange:(v:string)=>void;options:{value:string;label:string}[];label:string;id?:string;className?:string}) {
  return <Select value={value || undefined} onValueChange={onChange}><SelectTrigger id={id} className={`select-control ${className}`} aria-label={label}><SelectValue placeholder={label}/></SelectTrigger><SelectContent position="popper">{options.map(o=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>;
}
const colorNames=["Зелёный","Сиреневый","Голубой","Персиковый","Жёлтый","Серо-голубой"];
const iconNames=["Программирование","Математика","Матрица","Граф","Атом","Язык"];
export default function EditForm({modal,subjects,onClose,onSave}: {modal:EditModal;subjects:Subject[];onClose:()=>void;onSave:(action:Record<string,unknown>)=>Promise<unknown>}) {
  const item=modal.item;
  const [name,setName]=useState(modal.type==="subject" ? modal.item?.name || "" : "");
  const [color,setColor]=useState(modal.type==="subject" ? modal.item?.color || "green" : "green");
  const [icon,setIcon]=useState(modal.type==="subject" ? modal.item?.icon || "code" : "code");
  const [title,setTitle]=useState(modal.type==="resource" ? modal.item?.title || "" : "");
  const [description,setDescription]=useState(modal.type==="resource" ? modal.item?.description || "" : "");
  const [kind,setKind]=useState(modal.type==="lesson" ? modal.item?.kind || "Практика" : modal.type==="resource" ? modal.item?.kind || "other" : "other");
  const [url,setUrl]=useState(modal.type!=="subject" ? modal.item?.url || "" : "");
  const [subjectId,setSubjectId]=useState(modal.type!=="subject" ? modal.subjectId : "");
  const [date,setDate]=useState(modal.type==="lesson" ? modal.item?.date || modal.date : "");
  const [start,setStart]=useState(modal.type==="lesson" ? modal.item?.start || modal.start : "09:00");
  const [end,setEnd]=useState(modal.type==="lesson" ? modal.item?.end || modal.end : "10:30");
  const [repeat,setRepeat]=useState(modal.type==="lesson" ? String(modal.item?.repeat ?? 1) : "1");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const dialogTitle=modal.type==="subject" ? item ? "Редактировать дисциплину" : "Новая дисциплина" : modal.type==="resource" ? item ? "Редактировать ссылку" : "Новая ссылка" : item ? "Редактировать занятие" : "Новое занятие";
  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError("");
    const fields = new FormData(e.currentTarget);
    try {
      let action:Record<string,unknown>;
      if(modal.type==="subject") {
        if(!name.trim()) throw new Error("Введите название дисциплины.");
        action={action:"saveSubject",id:item?.id,name:name.trim(),color,icon};
      } else if(modal.type==="resource") {
        if(!url.trim()) throw new Error("Вставьте ссылку на страницу.");
        action={action:"saveResource",id:item?.id,subjectId,title:title.trim(),description:description.trim(),kind,url:normalizeUrl(url)};
      } else {
        if(!subjectId) throw new Error("Сначала выберите дисциплину.");
        const actualDate=String(fields.get("date") || date);
        const actualStart=String(fields.get("start") || start);
        const actualEnd=String(fields.get("end") || end);
        if(actualEnd<=actualStart) throw new Error("Время окончания должно быть позже начала.");
        action={action:"saveLesson",id:item?.id,subjectId,date:actualDate,start:actualStart,end:actualEnd,kind,repeat:Number(repeat),url:normalizeUrl(url)};
      }
      setBusy(true); await onSave(action); onClose();
    } catch(e) { setError(e instanceof Error ? e.message : "Не удалось сохранить. Попробуйте ещё раз."); }
    finally {setBusy(false);}
  }
  return <Dialog open onOpenChange={v=>{if(!v&&!busy)onClose();}}><DialogContent className="edit-dialog" showCloseButton={!busy}><DialogHeader><DialogTitle>{dialogTitle}</DialogTitle><DialogDescription>{modal.type==="subject" ? "Название, цвет и значок предмета." : modal.type==="resource" ? "Сохраните нужный адрес, чтобы он всегда был под рукой." : "Укажите дисциплину и время занятия."}</DialogDescription></DialogHeader><form onSubmit={submit} className="editor-form">
    <fieldset disabled={busy}>
    {modal.type==="subject" && <>
      <label className="field">Название дисциплины<input autoFocus required maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="Например, Программирование"/></label>
      <div className="field"><span>Цвет</span><RadioGroup className="color-picker" value={color} onValueChange={setColor} aria-label="Цвет дисциплины">{COLORS.map((c,i)=><label key={c} className={`color-swatch tone-${c} ${color===c?"is-selected":""}`} title={colorNames[i]}><RadioGroupItem value={c} className="sr-only" aria-label={colorNames[i]}/>{color===c && <Check size={20}/>}</label>)}</RadioGroup></div>
      <div className="field"><span>Значок</span><RadioGroup className="icon-picker" value={icon} onValueChange={setIcon} aria-label="Значок дисциплины">{ICONS.map((v,i)=><label key={v} className={`icon-option ${icon===v?"is-selected":""}`} title={iconNames[i]}><RadioGroupItem value={v} className="sr-only" aria-label={iconNames[i]}/><SubjectIcon name={v} size={26}/></label>)}</RadioGroup></div>
    </>}
    {modal.type==="resource" && <>
      <label className="field">Название<input autoFocus required maxLength={100} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Например, Конспекты"/></label>
      <label className="field">Ссылка<input required inputMode="url" maxLength={3000} value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://…"/></label>
      <div className="field"><label htmlFor="resource-kind">Тип ссылки</label><Pick id="resource-kind" label="Тип ссылки" value={kind} onChange={setKind} options={[{value:"lesson",label:"Урок"},{value:"course",label:"Курс"},{value:"materials",label:"Материалы"},{value:"other",label:"Другая ссылка"}]}/></div>
      <label className="field">Описание <span className="optional">необязательно</span><input maxLength={180} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Что находится по этой ссылке"/></label>
    </>}
    {modal.type==="lesson" && <>
      <div className="field"><label htmlFor="lesson-subject">Дисциплина</label><Pick id="lesson-subject" value={subjectId} onChange={setSubjectId} label="Выберите дисциплину" options={subjects.map(s=>({value:s.id,label:s.name}))}/></div>
      <div className="form-columns"><label className="field">{modal.item?.repeat ? "Дата начала повторения" : "Дата"}<input type="date" name="date" required value={date} onInput={e=>setDate(e.currentTarget.value)} onChange={e=>setDate(e.target.value)}/></label><div className="field"><label htmlFor="lesson-kind">Тип занятия</label><Pick id="lesson-kind" label="Тип занятия" value={kind} onChange={setKind} options={["Лекция","Практика","Лабораторная","Семинар","Другое"].map(v=>({value:v,label:v}))}/></div></div>
      <div className="form-columns"><label className="field">Начало<input type="time" name="start" required value={start} onInput={e=>setStart(e.currentTarget.value)} onChange={e=>setStart(e.target.value)}/></label><label className="field">Окончание<input type="time" name="end" required value={end} onInput={e=>setEnd(e.currentTarget.value)} onChange={e=>setEnd(e.target.value)}/></label></div>
      <div className="field"><label htmlFor="lesson-repeat">Повторение</label><Pick id="lesson-repeat" label="Повторение" value={repeat} onChange={setRepeat} options={[{value:"0",label:"Только в этот день"},{value:"1",label:"Каждую неделю"}]}/>{!!modal.item?.repeat && <p className="field-hint">Изменения применятся ко всем повторениям этого занятия.</p>}</div>
      <label className="field">Ссылка на занятие <span className="optional">необязательно</span><input inputMode="url" maxLength={3000} value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://…"/><span className="field-hint">Если оставить пустой, используется ссылка на урок из дисциплины.</span></label>
    </>}
    </fieldset>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button type="button" className="btn" onClick={onClose} disabled={busy}>Отмена</button><button type="submit" className="btn primary" disabled={busy}>{busy ? <Loader2 size={18} className="spin"/> : <Check size={18}/>} {busy?"Сохраняем…":"Сохранить"}</button></div>
  </form></DialogContent></Dialog>;
}
