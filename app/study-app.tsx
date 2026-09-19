"use client";
import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react";
import { BookOpen, CalendarDays, UserRound, LogOut, Plus, Search, MoreVertical, ChevronRight, X, Play, Folder, ExternalLink, Pencil, Trash2, Link2, Loader2, RefreshCw } from "lucide-react";
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import EditForm, { SubjectIcon, type EditModal } from "./study-forms";
import StudyCalendar from "./study-calendar";
import SubjectProductivity from "./subject-productivity";
import { linkCount, type StudyData, type Subject, type Resource, type Lesson } from "@/lib/study";

type DeletePrompt={action:"deleteSubject"|"deleteResource"|"deleteLesson";id:string;title:string;description:string};
type View="subjects"|"schedule";
type ModelTool={name:string;title:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean;untrustedContentHint:boolean};execute:(input:unknown)=>unknown};
type ModelContext={registerTool:(t:ModelTool,o:{signal:AbortSignal})=>void|Promise<void>};

export default function StudyApp({initialView}:{initialView:View}) {
  const [view,setView]=useState<View>(initialView);
  const [data,setData]=useState<StudyData|null>(null);
  const [error,setError]=useState("");
  const [query,setQuery]=useState("");
  const [selectedId,setSelectedId]=useState<string|null>("subject-0");
  const [narrow,setNarrow]=useState(false);
  const [mobileDetail,setMobileDetail]=useState(false);
  const [modal,setModal]=useState<EditModal|null>(null);
  const [deleting,setDeleting]=useState<DeletePrompt|null>(null);
  const [busy,setBusy]=useState(false);
  const stateRef=useRef({data,view}); stateRef.current={data,view};
  const load=useCallback(async()=>{
    setError("");
    try {const response=await fetch("/api/study",{cache:"no-store"});if(response.status===401){window.location.href="/login";return;}const next=await response.json() as StudyData & {error?:string;savedId:string};if(!response.ok)throw new Error(next.error);setData(next);}
    catch(e){setError(e instanceof Error?e.message:"Не удалось загрузить данные.");}
  },[]);
  useEffect(()=>{void load();const q=new URLSearchParams(window.location.search).get("subject");if(q)setSelectedId(q);const media=window.matchMedia("(max-width: 1199px)");const update=()=>setNarrow(media.matches);update();media.addEventListener("change",update);const pop=()=>{setView(window.location.pathname.startsWith("/schedule")?"schedule":"subjects");const id=new URLSearchParams(window.location.search).get("subject");if(id)setSelectedId(id);setModal(null);setMobileDetail(false);};window.addEventListener("popstate",pop);return()=>{media.removeEventListener("change",update);window.removeEventListener("popstate",pop);};},[load]);
  const navigate=useCallback((next:View,id?:string)=>{
    setView(next);setModal(null);setMobileDetail(false);
    window.history.pushState({},"",next==="schedule"?"/schedule":id?`/?subject=${encodeURIComponent(id)}`:"/");
    if(id){setSelectedId(id);setMobileDetail(true);}window.scrollTo({top:0,behavior:"instant"});
  },[]);
  useEffect(()=>{
    const context=(document as Document & {modelContext?:ModelContext}).modelContext;
    if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    const tools:ModelTool[]=[
      {name:"get_study_workspace",title:"Посмотреть учебное пространство",description:"Return the saved subjects, resources and lessons currently displayed. Does not modify data.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input){if(!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).length)throw new Error("Expected an empty object");if(!stateRef.current.data)throw new Error("Data is still loading");return stateRef.current.data;}},
      {name:"show_study_section",title:"Открыть раздел",description:"Navigate to the subjects or schedule section without changing saved data.",inputSchema:{type:"object",properties:{section:{type:"string",enum:["subjects","schedule"]}},required:["section"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){const p=input as {section?:string};if(!p||typeof p!=="object"||Object.keys(p).some(k=>k!=="section")||!["subjects","schedule"].includes(p.section||""))throw new Error("Unknown section");navigate(p.section as View);return {section:p.section};}},
      {name:"start_subject_creation",title:"Добавить дисциплину",description:"Open the new subject form. A subject is saved only when the user completes the form and selects Save.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).length)throw new Error("Expected an empty object");if(!stateRef.current.data)throw new Error("Data is still loading");setModal({type:"subject"});return {form:"subject",status:"opened"};}},
    ];
    tools.forEach(t=>{try{Promise.resolve(context.registerTool(t,{signal:lifecycle.signal})).catch(()=>{});}catch{}});
    return()=>lifecycle.abort();
  },[navigate]);
  const save=useCallback(async(action:Record<string,unknown>)=>{
    const response=await fetch("/api/study",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(action)});
    const next=await response.json() as StudyData & {error?:string;savedId:string};if(!response.ok)throw new Error(next.error || "Не удалось сохранить изменения.");
    setData(next);
    if(action.action==="saveSubject"){setSelectedId(next.savedId);setMobileDetail(false);}
    toast.success(String(action.action).startsWith("delete")?"Удалено":"Изменения сохранены");
    return next.savedId;
  },[]);
  const selected=data?.subjects.find(s=>s.id===selectedId);
  const found=data?.subjects.filter(s=>s.name.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru")))||[];
  function selectSubject(id:string) {setSelectedId(id);setMobileDetail(true);}
  function removeSubject(s:Subject){setDeleting({action:"deleteSubject",id:s.id,title:`Удалить «${s.name}»?`,description:"Дисциплина, её ссылки и все занятия в расписании будут удалены. Это действие нельзя отменить."});}
  function removeResource(r:Resource){setDeleting({action:"deleteResource",id:r.id,title:"Удалить ссылку?",description:`«${r.title}» исчезнет из дисциплины. Сам файл или страница по ссылке останется на месте.`});}
  function removeLesson(l:Lesson){setDeleting({action:"deleteLesson",id:l.id,title:"Удалить занятие?",description:l.repeat?"Это занятие и все его еженедельные повторения будут удалены из расписания.":"Занятие будет удалено из расписания. Дисциплина и её ссылки сохранятся."});}
  async function confirmDelete(){if(!deleting)return;setBusy(true);try{await save({action:deleting.action,id:deleting.id});if(deleting.action==="deleteSubject"&&selectedId===deleting.id){setSelectedId(null);setMobileDetail(false);}setDeleting(null);}catch(e){toast.error(e instanceof Error?e.message:"Не удалось удалить.");}finally{setBusy(false);}}
  const nav=(mobile=false)=><nav aria-label={mobile?"Разделы на телефоне":"Разделы"} className={mobile?"mobile-nav":""}>{mobile ? <>{(["subjects","schedule"] as View[]).map(v=><a key={v} href={v==="subjects"?"/":"/schedule"} className={view===v?"active":""} aria-current={view===v?"page":undefined} onClick={e=>{e.preventDefault();navigate(v);}}>{v==="subjects"?<BookOpen size={21}/>:<CalendarDays size={21}/>}<span>{v==="subjects"?"Дисциплины":"Расписание"}</span></a>)}</> : <SidebarMenu>{(["subjects","schedule"] as View[]).map(v=><SidebarMenuItem key={v}><SidebarMenuButton asChild isActive={view===v} className="nav-item"><a href={v==="subjects"?"/":"/schedule"} aria-current={view===v?"page":undefined} onClick={e=>{e.preventDefault();navigate(v);}}>{v==="subjects"?<BookOpen/>:<CalendarDays/>}<span>{v==="subjects"?"Дисциплины":"Расписание"}</span></a></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu>}</nav>;
  const detail=selected && data && <div className="detail-inner">
    <div className="detail-top"><p className="eyebrow">Дисциплина</p><button className="icon-btn quiet" onClick={()=>{setSelectedId(null);setMobileDetail(false);}} aria-label="Закрыть дисциплину"><X size={24}/></button></div>
    <div className={`subject-icon hero-icon tone-${selected.color}`}><SubjectIcon name={selected.icon} size={56}/></div>
    <h2 className="detail-title">{selected.name}</h2><p className="detail-subtitle">Ссылки, заметки, задания и файлы</p>
    <SubjectProductivity subject={selected} data={data} onSave={save} onReload={load} linksSection={<section className="productivity-section links-section">
      <div className="productivity-heading"><span className="productivity-icon"><Link2 size={19}/></span><div><h3>Ссылки</h3><p>Уроки, курсы и учебные материалы</p></div></div>
      <div className="resource-list">{data.resources.filter(r=>r.subjectId===selected.id).map(r=>{const Icon=r.kind==="lesson"?Play:r.kind==="course"?BookOpen:r.kind==="materials"?Folder:Link2;const label=r.kind==="lesson"?"Открыть урок":r.kind==="course"?"Открыть курс":r.kind==="materials"?"Открыть папку":"Открыть ссылку";return <article className="resource-card" key={r.id}><div className={`resource-icon ${r.kind==="lesson"?"tone-green":r.kind==="materials"?"tone-yellow":"tone-slate"}`}><Icon size={27}/></div><div className="resource-body"><div className="resource-title-row"><h3>{r.title}</h3><DropdownMenu><DropdownMenuTrigger asChild><button className="mini-menu" aria-label={`Действия со ссылкой ${r.title}`}><MoreVertical size={17}/></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={()=>setModal({type:"resource",item:r,subjectId:selected.id})}><Pencil/>Редактировать</DropdownMenuItem><DropdownMenuItem className="text-red-600" onSelect={()=>removeResource(r)}><Trash2/>Удалить ссылку</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div><p>{r.description || (r.url?new URL(r.url).hostname:"Ссылка ещё не добавлена")}</p>{r.url ? <a className={`btn resource-open ${r.kind==="lesson"?"primary":""}`} href={r.url} target="_blank" rel="noopener noreferrer">{label}<ExternalLink size={18}/></a> : <button className={`btn resource-open ${r.kind==="lesson"?"primary":""}`} onClick={()=>setModal({type:"resource",item:r,subjectId:selected.id})}>Добавить ссылку<Plus size={18}/></button>}</div></article>;})}</div>
      <button className="btn dashed add-resource" onClick={()=>setModal({type:"resource",subjectId:selected.id})}><Plus size={21}/>Добавить ссылку</button>
    </section>}/>
    <div className="detail-actions"><button className="btn" onClick={()=>setModal({type:"subject",item:selected})}><Pencil size={21}/>Редактировать</button><button className="btn danger" onClick={()=>removeSubject(selected)}><Trash2 size={20}/>Удалить дисциплину</button></div>
  </div>;
  async function logout(){await fetch("/api/auth/logout",{method:"POST"});window.location.href="/login";}
  return <SidebarProvider style={{"--sidebar-width":"250px"} as CSSProperties} className="study-shell"><a className="skip-link" href="#main">К содержимому</a><Sidebar collapsible="none" className="study-sidebar"><SidebarHeader className="brand"><BookOpen size={37} strokeWidth={1.7}/><span>Моя учёба</span></SidebarHeader><SidebarContent><SidebarGroup className="navigation-group"><SidebarGroupLabel className="workspace-label">Рабочее пространство</SidebarGroupLabel>{nav()}</SidebarGroup></SidebarContent><SidebarFooter className="sidebar-bottom"><UserRound size={22}/><span>Личное пространство</span><button className="logout-button" onClick={()=>void logout()} aria-label="Выйти"><LogOut size={20}/></button></SidebarFooter></Sidebar><div className="mobile-header"><div className="brand"><BookOpen size={29}/><span>Моя учёба</span></div>{nav(true)}</div>
    <div className={`workspace ${view==="subjects" && selected && !narrow?"with-detail":""}`}><main id="main" className={`main-content ${view==="schedule"?"schedule-main":"subjects-main"}`}>
      {view==="subjects" && <><header className="page-header"><div><p className="eyebrow">Мои предметы</p><h1>Дисциплины</h1><p className="page-subtitle">Уроки, курсы и материалы в одном месте</p></div><button className="btn primary add-main" disabled={!data} onClick={()=>setModal({type:"subject"})}><Plus/>Добавить дисциплину</button></header><div className="search-field"><Search size={25}/><input aria-label="Найти дисциплину" placeholder="Найти дисциплину" value={query} onChange={e=>setQuery(e.target.value)}/>{query && <button className="icon-btn quiet" aria-label="Очистить поиск" onClick={()=>setQuery("")}><X size={19}/></button>}</div></>}
      {error ? <Empty className="empty-state"><EmptyHeader><EmptyMedia variant="icon"><RefreshCw/></EmptyMedia><EmptyTitle>Не удалось загрузить данные</EmptyTitle><EmptyDescription>{error}</EmptyDescription></EmptyHeader><button className="btn primary" onClick={()=>void load()}>Попробовать снова</button></Empty> : !data ? <div className="loading-surface" aria-label="Загрузка дисциплин" role="status"><span className="sr-only">Загружаем учебное пространство</span>{Array.from({length:6},(_,i)=><Skeleton key={i} className="loading-card"/>)}</div> : view==="subjects" ? <><p className="section-count">{query?"Найдено дисциплин":"Все дисциплины"} <span>· {found.length}</span></p><div className={`subjects-grid ${!selected?"expanded":""}`}>{found.map(s=><article key={s.id} className={`subject-card ${selectedId===s.id?"is-selected":""}`}><button className="subject-card-main" onClick={()=>selectSubject(s.id)} aria-label={`Открыть дисциплину ${s.name}`}><div className={`subject-icon tone-${s.color}`}><SubjectIcon name={s.icon} size={41}/></div><div className="subject-info"><h2>{s.name}</h2><p>{linkCount(data.resources.filter(r=>r.subjectId===s.id&&r.url).length)}</p></div></button><DropdownMenu><DropdownMenuTrigger asChild><button className="subject-menu mini-menu" aria-label={`Действия с дисциплиной ${s.name}`}><MoreVertical size={22}/></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={()=>selectSubject(s.id)}><BookOpen/>Открыть</DropdownMenuItem><DropdownMenuItem onSelect={()=>setModal({type:"subject",item:s})}><Pencil/>Редактировать</DropdownMenuItem><DropdownMenuSeparator/><DropdownMenuItem className="text-red-600" onSelect={()=>removeSubject(s)}><Trash2/>Удалить дисциплину</DropdownMenuItem></DropdownMenuContent></DropdownMenu><button className="subject-open" onClick={()=>selectSubject(s.id)} aria-label={`Открыть ${s.name}`}><span>Открыть</span><ChevronRight size={23}/></button></article>)}</div>{!found.length && <Empty className="empty-state"><EmptyHeader><EmptyMedia variant="icon">{query?<Search/>:<BookOpen/>}</EmptyMedia><EmptyTitle>{query?"Ничего не нашлось":"Пока нет дисциплин"}</EmptyTitle><EmptyDescription>{query?"Попробуйте другое название или очистите поиск.":"Добавьте первый предмет и сохраните ссылки на занятия."}</EmptyDescription></EmptyHeader><button className="btn primary" onClick={()=>query?setQuery(""):setModal({type:"subject"})}>{query?"Очистить поиск":"Добавить дисциплину"}</button></Empty>}</> : <StudyCalendar data={data} onEdit={setModal} onDelete={removeLesson} onSubject={id=>navigate("subjects",id)}/>}
    </main>{view==="subjects" && selected && !narrow && <aside className="discipline-detail" aria-label="Ссылки дисциплины">{detail}</aside>}</div>
    <Sheet open={view==="subjects"&&!!selected&&narrow&&mobileDetail} onOpenChange={setMobileDetail}><SheetContent className="mobile-detail" showCloseButton={false}><SheetTitle className="sr-only">{selected?.name || "Дисциплина"}</SheetTitle><SheetDescription className="sr-only">Ссылки на урок, курс и материалы</SheetDescription>{narrow&&detail}</SheetContent></Sheet>
    {modal && data && <EditForm key={`${modal.type}-${modal.item?.id||"new"}`} modal={modal} subjects={data.subjects} onClose={()=>setModal(null)} onSave={save}/>}
    <AlertDialog open={!!deleting} onOpenChange={open=>{if(!open&&!busy)setDeleting(null);}}><AlertDialogContent className="delete-dialog"><AlertDialogHeader><AlertDialogTitle>{deleting?.title}</AlertDialogTitle><AlertDialogDescription>{deleting?.description}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Отмена</AlertDialogCancel><AlertDialogAction className="delete-confirm" disabled={busy} onClick={e=>{e.preventDefault();void confirmDelete();}}>{busy?<Loader2 size={16} className="spin"/>:<Trash2 size={16}/>}Удалить</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <Toaster position="bottom-center" theme="light" richColors closeButton/>
  </SidebarProvider>;
}
