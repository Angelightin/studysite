"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, CheckCircle2, Circle, ListTodo, NotebookPen, Plus, Save, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import type { StudyData, Subject } from "@/lib/study";

type Props = {
  subject: Subject;
  data: StudyData;
  onSave: (action: Record<string, unknown>) => Promise<unknown>;
};

export default function SubjectProductivity({ subject, data, onSave }: Props) {
  const storedNote = data.notes.find(note => note.subjectId === subject.id)?.content ?? "";
  const [note, setNote] = useState(storedNote);
  const [noteBusy, setNoteBusy] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskBusy, setTaskBusy] = useState(false);
  const tasks = useMemo(() => data.tasks.filter(task => task.subjectId === subject.id), [data.tasks, subject.id]);
  const completed = tasks.filter(task => task.completed).length;
  const progress = tasks.length ? Math.round(completed / tasks.length * 100) : 0;

  useEffect(() => setNote(storedNote), [subject.id, storedNote]);

  async function saveNote() {
    setNoteBusy(true);
    try { await onSave({ action: "saveNote", subjectId: subject.id, content: note }); }
    finally { setNoteBusy(false); }
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = taskTitle.trim();
    if (!title) return;
    setTaskBusy(true);
    try {
      await onSave({ action: "saveTask", subjectId: subject.id, title });
      setTaskTitle("");
    } finally { setTaskBusy(false); }
  }

  return <div className="subject-productivity">
    <section className="productivity-section notes-section">
      <div className="productivity-heading"><span className="productivity-icon"><NotebookPen size={19}/></span><div><h3>Заметки</h3><p>Конспект, важные даты и напоминания</p></div></div>
      <textarea aria-label={`Заметки по дисциплине ${subject.name}`} value={note} onChange={event => setNote(event.target.value)} maxLength={12000} placeholder="Запиши здесь то, что важно не забыть…" rows={5}/>
      <div className="notes-footer"><span>{note.length.toLocaleString("ru-RU")} / 12 000</span><button className="btn save-note" onClick={saveNote} disabled={noteBusy || note === storedNote}><Save size={17}/>{noteBusy ? "Сохраняем…" : note === storedNote ? "Сохранено" : "Сохранить"}</button></div>
    </section>

    <section className="productivity-section tasks-section">
      <div className="productivity-heading tasks-heading"><span className="productivity-icon"><ListTodo size={20}/></span><div><h3>Задачи</h3><p>{tasks.length ? `${completed} из ${tasks.length} выполнено` : "Добавь первую задачу"}</p></div><strong>{progress}%</strong></div>
      <Progress value={progress} aria-label={`Выполнено ${progress}% задач по дисциплине ${subject.name}`} className="tasks-progress"/>
      <form className="add-task-form" onSubmit={addTask}><input aria-label="Новая задача" value={taskTitle} onChange={event => setTaskTitle(event.target.value)} maxLength={240} placeholder="Например, решить задачи к пятнице"/><button className="btn primary" type="submit" disabled={taskBusy || !taskTitle.trim()}><Plus size={18}/>{taskBusy ? "Добавляем…" : "Добавить задачу"}</button></form>
      <div className="task-list" aria-live="polite">
        {tasks.map(task => <article key={task.id} className={`task-item ${task.completed ? "is-complete" : ""}`}>
          <Checkbox checked={Boolean(task.completed)} onCheckedChange={checked => void onSave({ action: "toggleTask", id: task.id, completed: checked ? 1 : 0 })} aria-label={task.completed ? `Отметить задачу «${task.title}» невыполненной` : `Отметить задачу «${task.title}» выполненной`}/>
          <span className="task-status-icon">{task.completed ? <CheckCircle2 size={17}/> : <Circle size={17}/>}</span>
          <p>{task.title}</p>
          <button className="mini-menu task-delete" aria-label={`Удалить задачу ${task.title}`} onClick={() => void onSave({ action: "deleteTask", id: task.id })}><Trash2 size={16}/></button>
        </article>)}
        {!tasks.length && <div className="tasks-empty"><Check size={20}/><span>Пока всё сделано — новых задач нет</span></div>}
      </div>
    </section>
  </div>;
}
