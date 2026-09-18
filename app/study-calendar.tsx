"use client";
import { useState, useMemo, Fragment } from "react";
import { Plus, ChevronLeft, ChevronRight, ExternalLink, Pencil, Trash2, CalendarDays, ArrowRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pick, SubjectIcon, type EditModal } from "./study-forms";
import { SLOTS, DAYS, addDays, dateKey, parseDay, monday, occursOn, type StudyData, type Lesson } from "@/lib/study";

type Props={data:StudyData;onEdit:(m:EditModal)=>void;onDelete:(l:Lesson)=>void;onSubject:(id:string)=>void};
export default function StudyCalendar({data,onEdit,onDelete,onSubject}:Props) {
  const [anchor,setAnchor]=useState(()=>new Date());
  const [mode,setMode]=useState("week");
  const [filter,setFilter]=useState("all");
  const [selection,setSelection]=useState<{id:string;date:string}|null>(null);
  const today=dateKey(new Date());
  const weekStart=monday(anchor);
  const weekDays=Array.from({length:7},(_,i)=>addDays(weekStart,i));
  const monthStart=new Date(anchor.getFullYear(),anchor.getMonth(),1,12);
  const monthEnd=new Date(anchor.getFullYear(),anchor.getMonth()+1,0,12);
  const monthGridStart=monday(monthStart);
  const monthCount=Math.ceil((((monthStart.getDay()+6)%7)+monthEnd.getDate())/7)*7;
  const monthDays=Array.from({length:monthCount},(_,i)=>addDays(monthGridStart,i));
  const days=mode==="week"?weekDays:monthDays;
  const actualFilter=data.subjects.some(s=>s.id===filter)?filter:"all";
  const lessons=data.lessons.filter(l=>(actualFilter==="all"||l.subjectId===actualFilter) && data.subjects.some(s=>s.id===l.subjectId));
  const forDay=(d:Date)=>lessons.filter(l=>occursOn(l,d)).sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end));
  const visible=days.flatMap(d=>forDay(d).map(l=>({lesson:l,date:dateKey(d)})));
  const chosen=(selection && visible.find(e=>e.lesson.id===selection.id&&e.date===selection.date)) || visible.find(e=>e.date===today&&e.lesson.subjectId==="subject-0") || visible.find(e=>e.date===today) || visible[0];
  const selectedSubject=chosen && data.subjects.find(s=>s.id===chosen.lesson.subjectId);
  const lessonResource=chosen && data.resources.find(r=>r.subjectId===chosen.lesson.subjectId&&r.kind==="lesson");
  const selectedUrl=chosen?.lesson.url || lessonResource?.url;
  const slots=useMemo(()=> {
    const pairs=new Map(SLOTS.map(p=>[p.join("-"),p]));
    data.lessons.forEach(l=>{if((actualFilter==="all"||l.subjectId===actualFilter)&&weekDays.some(d=>occursOn(l,d)))pairs.set(`${l.start}-${l.end}`,[l.start,l.end]);});
    return Array.from(pairs.values()).sort((a,b)=>a[0].localeCompare(b[0])||a[1].localeCompare(b[1]));
  },[data.lessons,actualFilter,dateKey(weekStart)]);
  function create(d:Date=new Date(),start="09:00",end="10:30") {
    if(!data.subjects.length){onEdit({type:"subject"});return;}
    onEdit({type:"lesson",date:dateKey(d),start,end,subjectId:actualFilter==="all"?data.subjects[0].id:actualFilter});
  }
  function edit(l:Lesson) {onEdit({type:"lesson",item:l,date:l.date,start:l.start,end:l.end,subjectId:l.subjectId});}
  function shift(n:number) {
    setAnchor(mode==="week"?addDays(anchor,n*7):new Date(anchor.getFullYear(),anchor.getMonth()+n,1,12));
    setSelection(null);
  }
  const shortDate=(d:Date)=>d.toLocaleDateString("ru-RU",{day:"numeric",month:"long"});
  const weekTitle=weekDays[0].getMonth()===weekDays[6].getMonth()?`${weekDays[0].getDate()}–${shortDate(weekDays[6])} ${weekDays[6].getFullYear()}`:`${shortDate(weekDays[0])} – ${shortDate(weekDays[6])} ${weekDays[6].getFullYear()}`;
  const monthTitle=anchor.toLocaleDateString("ru-RU",{month:"long",year:"numeric"}).replace(" г.","");
  function event(l:Lesson,d:Date,compact=false) {
    const subject=data.subjects.find(s=>s.id===l.subjectId)!;
    const selected=chosen?.lesson.id===l.id&&chosen.date===dateKey(d);
    return <button key={l.id} className={`calendar-event tone-${subject.color} ${selected?"is-selected":""} ${compact?"compact":""}`} onClick={()=>setSelection({id:l.id,date:dateKey(d)})} onDoubleClick={()=>edit(l)} aria-pressed={selected} aria-label={`${subject.name}, ${shortDate(d)}, ${l.start}–${l.end}, ${l.kind}`} title={`${subject.name} · ${l.start}–${l.end}`}>
      {compact && <span className="event-time">{l.start}</span>}<strong>{subject.name}</strong>{!compact && <span>{l.kind}</span>}
    </button>;
  }
  return <>
    <header className="page-header"><div><p className="eyebrow">Учебная неделя</p><h1>Расписание</h1><p className="page-subtitle">Все занятия по твоим дисциплинам</p></div><button className="btn primary add-main" onClick={()=>create()}><Plus/>Добавить занятие</button></header>
    <div className="calendar-toolbar"><div className="date-navigation"><button className="btn icon-btn" aria-label={mode==="week"?"Предыдущая неделя":"Предыдущий месяц"} onClick={()=>shift(-1)}><ChevronLeft/></button><h2>{mode==="week"?weekTitle:monthTitle}</h2><button className="btn icon-btn" aria-label={mode==="week"?"Следующая неделя":"Следующий месяц"} onClick={()=>shift(1)}><ChevronRight/></button><button className="btn today-btn" onClick={()=>{setAnchor(new Date());setSelection(null);}}>Сегодня</button></div><div className="calendar-options"><Tabs value={mode} onValueChange={v=>{setMode(v);setSelection(null);}}><TabsList className="view-tabs"><TabsTrigger value="week">Неделя</TabsTrigger><TabsTrigger value="month">Месяц</TabsTrigger></TabsList></Tabs><Pick label="Фильтр дисциплин" value={actualFilter} onChange={v=>{setFilter(v);setSelection(null);}} options={[{value:"all",label:"Все дисциплины"},...data.subjects.map(s=>({value:s.id,label:s.name}))]} className="subject-filter"/></div></div>
    {mode==="week" ? <>
      <div className="calendar-surface weekly-desktop"><Table className="week-table"><TableHeader><TableRow><TableHead className="time-head"><span className="sr-only">Время</span></TableHead>{weekDays.map((d,i)=><TableHead key={dateKey(d)} className={i>4?"weekend":""}><span className="day-label">{DAYS[i]}</span><span className={`day-number ${dateKey(d)===today?"is-today":""}`}>{d.getDate()}</span></TableHead>)}</TableRow></TableHeader><TableBody>{slots.map(([start,end])=><TableRow key={start+end}><TableCell className="time-cell"><span>{start}</span><span>{end}</span></TableCell>{weekDays.map((d,i)=>{const cell=forDay(d).filter(l=>l.start===start&&l.end===end);return <TableCell key={dateKey(d)} className={`schedule-cell ${i>4?"weekend":""}`}>{cell.length ? cell.map(l=>event(l,d)) : <button className="empty-slot" aria-label={`Добавить занятие ${shortDate(d)} в ${start}`} onClick={()=>create(d,start,end)}><Plus size={20}/></button>}</TableCell>;})}</TableRow>)}</TableBody></Table></div>
      <div className="weekly-mobile">{weekDays.map(d=><section key={dateKey(d)} className="agenda-day"><div className="agenda-heading"><h3 className={dateKey(d)===today?"today-text":""}>{d.toLocaleDateString("ru-RU",{weekday:"long",day:"numeric",month:"long"})}</h3><button className="btn icon-btn" aria-label={`Добавить занятие ${shortDate(d)}`} onClick={()=>create(d)}><Plus size={18}/></button></div>{forDay(d).length?forDay(d).map(l=><div className="agenda-row" key={l.id}><div className="agenda-time">{l.start}<span>{l.end}</span></div>{event(l,d)}</div>):<p className="free-day">Нет занятий</p>}</section>)}</div>
    </> : <div className="calendar-surface month-surface"><Table className="month-table"><TableHeader><TableRow>{DAYS.map((d,i)=><TableHead className={i>4?"weekend":""} key={d}>{d}</TableHead>)}</TableRow></TableHeader><TableBody>{Array.from({length:monthCount/7},(_,week)=><TableRow key={week}>{monthDays.slice(week*7,week*7+7).map((d,i)=><TableCell key={dateKey(d)} className={`${i>4?"weekend":""} ${d.getMonth()!==anchor.getMonth()?"other-month":""}`}><button className={`month-date ${dateKey(d)===today?"is-today":""}`} onClick={()=>create(d)} aria-label={`Добавить занятие ${shortDate(d)}`}>{d.getDate()}</button>{forDay(d).map(l=>event(l,d,true))}</TableCell>)}</TableRow>)}</TableBody></Table></div>}
    {chosen && selectedSubject ? <section className="selected-lesson" aria-label="Выбранное занятие"><div className={`subject-icon large tone-${selectedSubject.color}`}><SubjectIcon name={selectedSubject.icon} size={46}/></div><div className="selected-lesson-info"><p className="eyebrow">Выбранное занятие</p><h2>{selectedSubject.name}</h2><p className="lesson-date">{parseDay(chosen.date).toLocaleDateString("ru-RU",{weekday:"long",day:"numeric",month:"long"})} · {chosen.lesson.start}–{chosen.lesson.end}</p><button className="text-link" onClick={()=>onSubject(selectedSubject.id)}>Перейти к дисциплине <ArrowRight size={17}/></button></div><div className="selected-lesson-actions">{selectedUrl ? <a className="btn primary open-lesson" href={selectedUrl} target="_blank" rel="noopener noreferrer">Открыть урок<ExternalLink size={19}/></a> : <button className="btn primary open-lesson" onClick={()=>edit(chosen.lesson)}>Добавить ссылку<Plus size={19}/></button>}<button className="btn icon-btn" onClick={()=>edit(chosen.lesson)} aria-label="Редактировать выбранное занятие"><Pencil/></button><button className="btn icon-btn danger" onClick={()=>onDelete(chosen.lesson)} aria-label="Удалить выбранное занятие"><Trash2/></button></div></section> : <div className="no-lessons"><CalendarDays size={24}/><span>{data.subjects.length?"На этот период занятий нет":"Добавьте первую дисциплину, чтобы составить расписание"}</span><button className="text-link" onClick={()=>create()}>{data.subjects.length?"Добавить занятие":"Добавить дисциплину"}<Plus size={17}/></button></div>}
  </>;
}
