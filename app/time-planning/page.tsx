"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Pencil,
  Trash2,
  X,
  Dumbbell,
  BookOpen,
  Brain,
  Users,
  Coffee,
  MoreHorizontal,
  Filter,
  Flame,
  Target,
  Zap,
  CheckCircle2,
  Circle,
  Calendar,
  GraduationCap,
  Copy,
  CalendarDays,
  FileText,
  History,
  AlertCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = "high" | "medium" | "low";
type Category =
  | "fitness"
  | "free-time"
  | "exams"
  | "homework"
  | "personal-goals"
  | "learning"
  | "family-social"
  | "other";
type TaskStatus = "pending" | "completed";
type ExamImportance = "high" | "medium" | "low";

type ScheduleTask = {
  id: string;
  date: string;
  time: string;
  title: string;
  category: Category;
  priority: Priority;
  status: TaskStatus;
  endTime: string;
};

type Exam = {
  id: string;
  subject: string;
  date: string;
  time: string;
  importance: ExamImportance;
  notes: string;
};

// ─── Metadata ─────────────────────────────────────────────────────────────────

const CAT_META: Record<
  Category,
  { label: string; bg: string; text: string; border: string; icon: React.ReactNode; dot: string }
> = {
  fitness: {
    label: "כושר",
    bg: "bg-orange-500/15",
    text: "text-orange-300",
    border: "border-orange-400/30",
    icon: <Dumbbell size={13} />,
    dot: "bg-orange-400",
  },
  "free-time": {
    label: "זמן חופשי",
    bg: "bg-sky-500/15",
    text: "text-sky-300",
    border: "border-sky-400/30",
    icon: <Coffee size={13} />,
    dot: "bg-sky-400",
  },
  exams: {
    label: "חזרה לבחינות",
    bg: "bg-red-500/15",
    text: "text-red-300",
    border: "border-red-400/30",
    icon: <Flame size={13} />,
    dot: "bg-red-400",
  },
  homework: {
    label: "שיעורי בית",
    bg: "bg-amber-500/15",
    text: "text-amber-300",
    border: "border-amber-400/30",
    icon: <BookOpen size={13} />,
    dot: "bg-amber-400",
  },
  "personal-goals": {
    label: "מטרות אישיות",
    bg: "bg-purple-500/15",
    text: "text-purple-300",
    border: "border-purple-400/30",
    icon: <Target size={13} />,
    dot: "bg-purple-400",
  },
  learning: {
    label: "למידה",
    bg: "bg-violet-500/15",
    text: "text-violet-300",
    border: "border-violet-400/30",
    icon: <Brain size={13} />,
    dot: "bg-violet-400",
  },
  "family-social": {
    label: "משפחה/חברים",
    bg: "bg-pink-500/15",
    text: "text-pink-300",
    border: "border-pink-400/30",
    icon: <Users size={13} />,
    dot: "bg-pink-400",
  },
  other: {
    label: "אחר",
    bg: "bg-zinc-500/15",
    text: "text-zinc-400",
    border: "border-zinc-600/30",
    icon: <MoreHorizontal size={13} />,
    dot: "bg-zinc-500",
  },
};

const PRIORITY_META: Record<
  Priority,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  high:   { label: "גבוהה",  bg: "bg-red-500/15",    text: "text-red-300",    border: "border-red-500/30",    dot: "bg-red-500"    },
  medium: { label: "בינונית", bg: "bg-yellow-500/15", text: "text-yellow-300", border: "border-yellow-500/30", dot: "bg-yellow-400" },
  low:    { label: "נמוכה",  bg: "bg-zinc-600/15",   text: "text-zinc-400",   border: "border-zinc-600/30",   dot: "bg-zinc-500"   },
};

const EXAM_IMP_META: Record<
  ExamImportance,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  high:   { label: "קריטי", bg: "bg-red-500/15",    text: "text-red-300",    border: "border-red-500/30",    dot: "bg-red-500"    },
  medium: { label: "חשוב",  bg: "bg-amber-500/15",  text: "text-amber-300",  border: "border-amber-500/30",  dot: "bg-amber-400"  },
  low:    { label: "רגיל",  bg: "bg-zinc-600/15",   text: "text-zinc-400",   border: "border-zinc-600/30",   dot: "bg-zinc-500"   },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T00:00:00").getTime();
  const base   = new Date(todayStr  + "T00:00:00").getTime();
  return Math.ceil((target - base) / 86_400_000);
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TODAY = new Date();
const todayStr     = fmtDate(TODAY);
const tomorrowStr  = fmtDate(addDays(TODAY, 1));
const yesterdayStr = fmtDate(addDays(TODAY, -1));
const in2 = fmtDate(addDays(TODAY, 2));
const in3 = fmtDate(addDays(TODAY, 3));

// June 20 deadline (current year, or next year if already past)
const EXAM_DEADLINE = (() => {
  const d = new Date(TODAY.getFullYear(), 5, 20);
  return d >= TODAY ? d : new Date(TODAY.getFullYear() + 1, 5, 20);
})();
const EXAM_DEADLINE_STR = fmtDate(EXAM_DEADLINE);

// ─── Mock data ────────────────────────────────────────────────────────────────

const SEED_TASKS: ScheduleTask[] = [
  { id: "y1", date: yesterdayStr, time: "07:00", endTime: "08:00", title: "אימון בוקר – כוח עליון",      category: "fitness",        priority: "high",   status: "completed" },
  { id: "y2", date: yesterdayStr, time: "10:00", endTime: "11:30", title: "לימוד TypeScript",             category: "learning",       priority: "medium", status: "completed" },
  { id: "y3", date: yesterdayStr, time: "14:00", endTime: "14:45", title: "שיעורי בית – היסטוריה",        category: "homework",       priority: "low",    status: "completed" },
  { id: "y4", date: yesterdayStr, time: "19:00", endTime: "21:00", title: "ערב משפחה",                   category: "family-social",  priority: "medium", status: "completed" },
  // last-week copy source (7 days ago) – same pattern so copy-week has data
  { id: "w1", date: fmtDate(addDays(TODAY, -7)), time: "07:00", endTime: "08:00", title: "אימון בוקר – רגליים",  category: "fitness",   priority: "high",   status: "completed" },
  { id: "w2", date: fmtDate(addDays(TODAY, -7)), time: "09:00", endTime: "10:30", title: "חזרה לבחינה",          category: "exams",     priority: "high",   status: "completed" },
  { id: "w3", date: fmtDate(addDays(TODAY, -7)), time: "14:00", endTime: "15:00", title: "לימוד React",           category: "learning",  priority: "medium", status: "completed" },
  { id: "w4", date: fmtDate(addDays(TODAY, -7)), time: "18:00", endTime: "18:45", title: "שיעורי בית – אנגלית",  category: "homework",  priority: "medium", status: "completed" },
  { id: "w5", date: fmtDate(addDays(TODAY, -7)), time: "20:00", endTime: "21:00", title: "זמן חופשי",             category: "free-time", priority: "low",    status: "completed" },
  // Today
  { id: "t1", date: todayStr, time: "07:00", endTime: "08:00", title: "אימון בוקר – רגליים",          category: "fitness",        priority: "high",   status: "completed" },
  { id: "t2", date: todayStr, time: "09:00", endTime: "10:30", title: "חזרה למבחן מתמטיקה",           category: "exams",          priority: "high",   status: "pending"   },
  { id: "t3", date: todayStr, time: "12:00", endTime: "12:45", title: "שיעורי בית – אנגלית",          category: "homework",       priority: "medium", status: "pending"   },
  { id: "t4", date: todayStr, time: "14:00", endTime: "15:00", title: "לימוד Next.js",                category: "learning",       priority: "medium", status: "pending"   },
  { id: "t5", date: todayStr, time: "16:00", endTime: "17:15", title: "אימון כושר – כוח עליון",       category: "fitness",        priority: "high",   status: "pending"   },
  { id: "t6", date: todayStr, time: "18:00", endTime: "19:00", title: "שיעורי בית – פיזיקה",          category: "homework",       priority: "medium", status: "pending"   },
  { id: "t7", date: todayStr, time: "20:00", endTime: "21:30", title: "חזרה לבחינת פיזיקה",           category: "exams",          priority: "high",   status: "pending"   },
  { id: "t8", date: todayStr, time: "22:00", endTime: "23:00", title: "זמן חופשי – נטפליקס",          category: "free-time",      priority: "low",    status: "pending"   },
  // Tomorrow
  { id: "m1", date: tomorrowStr, time: "08:00", endTime: "08:30", title: "ריצת בוקר",                  category: "fitness",        priority: "medium", status: "pending" },
  { id: "m2", date: tomorrowStr, time: "10:00", endTime: "12:00", title: "פרויקט אישי – האפליקציה",    category: "personal-goals", priority: "high",   status: "pending" },
  { id: "m3", date: tomorrowStr, time: "17:00", endTime: "18:30", title: "ארוחה משפחתית",              category: "family-social",  priority: "medium", status: "pending" },
  { id: "m4", date: tomorrowStr, time: "20:00", endTime: "21:00", title: "זמן חופשי",                   category: "free-time",      priority: "low",    status: "pending" },
  // +2, +3
  { id: "d1", date: in2, time: "09:00", endTime: "11:00", title: "חזרה לבחינת פיזיקה",   category: "exams",     priority: "high",   status: "pending" },
  { id: "d2", date: in2, time: "13:00", endTime: "14:00", title: "אימון – גב וכתפיים",   category: "fitness",   priority: "medium", status: "pending" },
  { id: "d3", date: in2, time: "18:00", endTime: "19:30", title: "לימוד React",           category: "learning",  priority: "medium", status: "pending" },
  { id: "e1", date: in3, time: "10:00", endTime: "12:00", title: "חזרה אחרונה – מתמטיקה", category: "exams",    priority: "high",   status: "pending" },
  { id: "e2", date: in3, time: "16:00", endTime: "17:30", title: "זמן חופשי – פארק",      category: "free-time", priority: "low",   status: "pending" },
  { id: "e3", date: in3, time: "19:00", endTime: "20:30", title: "לימוד לקורס אוניברסיטה", category: "learning", priority: "high",  status: "pending" },
];

const SEED_EXAMS: Exam[] = [
  { id: "ex1", subject: "מתמטיקה",   date: fmtDate(addDays(TODAY, 2)),  time: "09:00", importance: "high",   notes: "פרקים 5–8, אינטגרלים ומשוואות דיפרנציאליות" },
  { id: "ex2", subject: "פיזיקה",    date: fmtDate(addDays(TODAY, 5)),  time: "11:00", importance: "high",   notes: "מכניקה, גלים, אלקטרומגנטיות" },
  { id: "ex3", subject: "אנגלית",    date: fmtDate(addDays(TODAY, 12)), time: "09:00", importance: "medium", notes: "Reading comprehension + Writing + Grammar" },
  { id: "ex4", subject: "היסטוריה",  date: fmtDate(addDays(TODAY, 20)), time: "10:00", importance: "medium", notes: "מלחמת העולם ה-2 ומדינת ישראל" },
  { id: "ex5", subject: "כימיה",     date: fmtDate(addDays(TODAY, 28)), time: "09:00", importance: "high",   notes: "תגובות כימיות, טבלה מחזורית, אלקטרוכימיה" },
  { id: "ex6", subject: "ספרות",     date: fmtDate(addDays(TODAY, 35)), time: "08:30", importance: "low",    notes: "ניתוח יצירות: עגנון + ביאליק" },
  { id: "ex7", subject: "מחשבים",    date: fmtDate(addDays(TODAY, 42)), time: "10:00", importance: "medium", notes: "אלגוריתמים, מבני נתונים, SQL" },
  { id: "ex8", subject: "גיאוגרפיה", date: fmtDate(addDays(TODAY, 50)), time: "09:00", importance: "low",    notes: "ישראל ואזורי העולם" },
];

let nextId = 1000;
function genId() { return String(nextId++); }

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function CategoryChip({ cat }: { cat: Category }) {
  const m = CAT_META[cat];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${m.bg} ${m.text} ${m.border}`}>
      {m.icon}{m.label}
    </span>
  );
}

function PriorityBadge({ p }: { p: Priority }) {
  const m = PRIORITY_META[p];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${m.bg} ${m.text} ${m.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />{m.label}
    </span>
  );
}

function ImportanceBadge({ imp }: { imp: ExamImportance }) {
  const m = EXAM_IMP_META[imp];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${m.bg} ${m.text} ${m.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />{m.label}
    </span>
  );
}

function StatCard({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub: string; color: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-zinc-500">{label}</span>
        {icon}
      </div>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      <p className="text-[11px] text-zinc-600 mt-0.5">{sub}</p>
    </div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border transition-all
        ${active ? "bg-white text-zinc-950 border-white" : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"}`}
    >
      {label}
    </button>
  );
}

// ─── Task card ────────────────────────────────────────────────────────────────

function TaskCard({ task, onToggle, onEdit, onDelete }: {
  task: ScheduleTask; onToggle: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const done = task.status === "completed";
  const leftBorder: Record<Priority, string> = { high: "border-l-red-500", medium: "border-l-yellow-500", low: "border-l-zinc-700" };

  return (
    <div className={`flex items-start gap-3 rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-3 transition-all duration-200 border-l-2 ${leftBorder[task.priority]} ${done ? "opacity-50" : "hover:border-zinc-700/60"}`}>
      <button onClick={onToggle} className="mt-0.5 shrink-0 text-zinc-500 hover:text-white transition-colors">
        {done ? <CheckCircle2 size={18} className="text-green-400" /> : <Circle size={18} />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {task.endTime ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-black text-zinc-300 bg-zinc-800 rounded-lg px-2 py-0.5 font-mono tabular-nums">
              <Clock size={10} className="text-zinc-500" />
              {task.time}
              <span className="text-zinc-600 mx-0.5">–</span>
              {task.endTime}
            </span>
          ) : (
            <span className="text-[11px] font-black text-zinc-400 bg-zinc-800 rounded px-1.5 py-0.5 font-mono tabular-nums">{task.time}</span>
          )}
        </div>
        <p className={`text-sm font-bold leading-snug ${done ? "line-through text-zinc-600" : "text-white"}`}>{task.title}</p>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <CategoryChip cat={task.category} />
          <PriorityBadge p={task.priority} />
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 mt-0.5">
        <button onClick={onEdit}   className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-all"><Pencil size={13} /></button>
        <button onClick={onDelete} className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

// ─── Copy-week panel ──────────────────────────────────────────────────────────

function CopyWeekPanel({
  selectedDate,
  tasksByDate,
  onCopy,
  onClose,
}: {
  selectedDate: string;
  tasksByDate: Record<string, ScheduleTask[]>;
  onCopy: (weeksAgo: number) => void;
  onClose: () => void;
}) {
  const options = [1, 2, 3].map((w) => {
    const srcDate = fmtDate(addDays(new Date(selectedDate + "T00:00:00"), -7 * w));
    const srcTasks = tasksByDate[srcDate] ?? [];
    const srcDay = new Date(srcDate + "T00:00:00").toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "short" });
    return { weeksAgo: w, srcDate, srcTasks, srcDay, label: w === 1 ? "שבוע שעבר" : `לפני ${w} שבועות` };
  });

  return (
    <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History size={14} className="text-indigo-400" />
          <span className="text-sm font-black text-indigo-300">ייבא לוח מהשבועות הקודמים</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors">
          <X size={14} />
        </button>
      </div>
      <p className="text-[11px] text-zinc-500">בחר שבוע להעתיק ממנו — המשימות ייוצאו ליום הנבחר כ-"ממתין"</p>

      <div className="space-y-2">
        {options.map(({ weeksAgo, srcDay, srcTasks, label }) => {
          const hasTasks = srcTasks.length > 0;
          return (
            <div
              key={weeksAgo}
              className={`flex items-center gap-3 rounded-xl border p-3 transition-all
                ${hasTasks ? "border-zinc-700/60 bg-zinc-900/60 hover:border-indigo-500/40" : "border-zinc-800/40 bg-zinc-900/20 opacity-50"}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">{label}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">{srcDay}</p>
                <p className={`text-[11px] mt-0.5 font-bold ${hasTasks ? "text-indigo-400" : "text-zinc-600"}`}>
                  {hasTasks ? `${srcTasks.length} משימות זמינות` : "אין משימות"}
                </p>
              </div>
              {hasTasks ? (
                <button
                  onClick={() => onCopy(weeksAgo)}
                  className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl px-3 py-2 text-xs font-black transition-colors shrink-0"
                >
                  <Copy size={12} />
                  העתק
                </button>
              ) : (
                <span className="text-[10px] text-zinc-600 border border-zinc-800 rounded-xl px-3 py-2">ריק</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Schedule calendar ────────────────────────────────────────────────────────

const HEB_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
const DAY_LABELS  = ["ב׳","ג׳","ד׳","ה׳","ו׳","ש׳","א׳"];

function ScheduleCalendar({
  year, month, selectedDate, tasksByDate, onSelect, onPrev, onNext,
}: {
  year: number; month: number; selectedDate: string;
  tasksByDate: Record<string, ScheduleTask[]>;
  onSelect: (d: string) => void; onPrev: () => void; onNext: () => void;
}) {
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onPrev} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"><ChevronLeft size={16} /></button>
        <span className="text-sm font-bold text-white">{HEB_MONTHS[month]} {year}</span>
        <button onClick={onNext} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d) => <div key={d} className="text-center text-[10px] font-bold text-zinc-600 py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday = ds === todayStr;
          const isSel   = ds === selectedDate;
          const prios   = new Set((tasksByDate[ds] ?? []).map((t) => t.priority));
          return (
            <button
              key={i}
              onClick={() => onSelect(ds)}
              className={`flex flex-col items-center py-1.5 rounded-lg text-sm font-bold transition-all duration-150
                ${isSel ? "bg-white text-zinc-950 shadow-md" : isToday ? "bg-zinc-800 text-white ring-1 ring-white/20" : "text-zinc-400 hover:bg-zinc-800/60 hover:text-white"}`}
            >
              {day}
              {prios.size > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {prios.has("high")   && <span className={`w-1 h-1 rounded-full ${isSel ? "bg-red-500"    : "bg-red-400"   }`} />}
                  {prios.has("medium") && <span className={`w-1 h-1 rounded-full ${isSel ? "bg-yellow-500" : "bg-yellow-400"}`} />}
                  {!prios.has("high") && !prios.has("medium") && <span className={`w-1 h-1 rounded-full ${isSel ? "bg-zinc-600" : "bg-zinc-500"}`} />}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Exam calendar ────────────────────────────────────────────────────────────

function ExamCalendar({
  year, month, selectedDate, examsByDate, onSelect, onPrev, onNext,
}: {
  year: number; month: number; selectedDate: string;
  examsByDate: Record<string, Exam[]>;
  onSelect: (d: string) => void; onPrev: () => void; onNext: () => void;
}) {
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="bg-zinc-900/60 border border-indigo-900/30 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onPrev} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"><ChevronLeft size={16} /></button>
        <span className="text-sm font-bold text-white">{HEB_MONTHS[month]} {year}</span>
        <button onClick={onNext} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d) => <div key={d} className="text-center text-[10px] font-bold text-indigo-900/60 py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday    = ds === todayStr;
          const isSel      = ds === selectedDate;
          const isPast     = ds < todayStr;
          const isPastDL   = ds > EXAM_DEADLINE_STR;
          const dayExams   = examsByDate[ds] ?? [];
          const hasExam    = dayExams.length > 0;
          const hasCritical = dayExams.some(e => e.importance === "high");

          return (
            <button
              key={i}
              onClick={() => onSelect(ds)}
              disabled={isPastDL}
              className={`flex flex-col items-center py-1.5 rounded-lg text-sm font-bold transition-all duration-150
                ${isPastDL   ? "text-zinc-800 cursor-default" :
                  isSel      ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/20" :
                  isToday    ? "bg-zinc-800 text-white ring-1 ring-indigo-500/30" :
                  isPast     ? "text-zinc-700 hover:text-zinc-500" :
                               "text-zinc-400 hover:bg-zinc-800/60 hover:text-white"}`}
            >
              {day}
              {hasExam && (
                <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSel ? "bg-white" : hasCritical ? "bg-red-400" : "bg-indigo-400"}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Task modal ───────────────────────────────────────────────────────────────

type TaskForm = { time: string; endTime: string; title: string; category: Category; priority: Priority };
const EMPTY_TASK_FORM: TaskForm = { time: "12:00", endTime: "13:00", title: "", category: "homework", priority: "medium" };

function TaskModal({ date, editing, onSave, onClose }: {
  date: string; editing: ScheduleTask | null;
  onSave: (t: ScheduleTask) => void; onClose: () => void;
}) {
  const [form, setForm] = useState<TaskForm>(
    editing
      ? { time: editing.time, endTime: editing.endTime, title: editing.title, category: editing.category, priority: editing.priority }
      : EMPTY_TASK_FORM
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave({ id: editing?.id ?? genId(), date: editing?.date ?? date, time: form.time, endTime: form.endTime, title: form.title.trim(), category: form.category, priority: form.priority, status: editing?.status ?? "pending" });
  }

  const cats = Object.entries(CAT_META) as [Category, (typeof CAT_META)[Category]][];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-700/50 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-base font-bold text-white">{editing ? "עריכת משימה" : "הוספת משימה"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-zinc-400 mb-1 block">כותרת</label>
            <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="שם המשימה..." className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors" required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-zinc-400 mb-1 block">שעה</label>
              <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500 transition-colors" />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-400 mb-1 block">שעת סיום</label>
              <input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500 transition-colors" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-zinc-400 mb-2 block">קטגוריה</label>
            <div className="grid grid-cols-4 gap-1.5">
              {cats.map(([key, meta]) => (
                <button key={key} type="button" onClick={() => setForm({ ...form, category: key })}
                  className={`flex flex-col items-center gap-1 rounded-xl py-2 px-1 border text-[10px] font-bold transition-all ${form.category === key ? `${meta.bg} ${meta.text} ${meta.border}` : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"}`}>
                  <span className={form.category === key ? meta.text : "text-zinc-500"}>{meta.icon}</span>
                  {meta.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-zinc-400 mb-2 block">עדיפות</label>
            <div className="grid grid-cols-3 gap-2">
              {(["high", "medium", "low"] as Priority[]).map((p) => {
                const m = PRIORITY_META[p];
                return (
                  <button key={p} type="button" onClick={() => setForm({ ...form, priority: p })}
                    className={`flex items-center justify-center gap-1.5 rounded-xl py-2 border text-xs font-bold transition-all ${form.priority === p ? `${m.bg} ${m.text} ${m.border}` : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"}`}>
                    <span className={`w-2 h-2 rounded-full ${m.dot}`} />{m.label}
                  </button>
                );
              })}
            </div>
          </div>
          <button type="submit" className="w-full bg-white text-zinc-950 rounded-xl py-2.5 text-sm font-black hover:bg-zinc-100 active:bg-zinc-200 transition-colors">
            {editing ? "שמור שינויים" : "הוסף משימה"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Exam card ────────────────────────────────────────────────────────────────

function ExamCard({ exam, onEdit, onDelete }: {
  exam: Exam; onEdit: () => void; onDelete: () => void;
}) {
  const days = daysUntil(exam.date);
  const dateLabel = new Date(exam.date + "T00:00:00").toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });

  type Urgency = "today" | "critical" | "soon" | "near" | "normal";
  const urgency: Urgency =
    days === 0 ? "today" :
    days <= 3  ? "critical" :
    days <= 7  ? "soon" :
    days <= 14 ? "near" : "normal";

  const countdownStyles: Record<Urgency, { box: string; num: string; sub: string }> = {
    today:    { box: "bg-red-500/25 border-red-400/40",    num: "text-red-200",    sub: "text-red-400"   },
    critical: { box: "bg-red-500/15 border-red-500/25",    num: "text-red-200",    sub: "text-red-500"   },
    soon:     { box: "bg-orange-500/15 border-orange-500/25", num: "text-orange-200", sub: "text-orange-500"},
    near:     { box: "bg-yellow-500/15 border-yellow-500/25", num: "text-yellow-200", sub: "text-yellow-500"},
    normal:   { box: "bg-zinc-800/80 border-zinc-700/40",  num: "text-white",      sub: "text-zinc-500"  },
  };
  const cs = countdownStyles[urgency];

  const cardBorder =
    urgency === "today"    ? "border-red-500/40 bg-red-500/5" :
    urgency === "critical" ? "border-red-500/25 bg-red-500/3" :
    urgency === "soon"     ? "border-orange-500/20" :
    urgency === "near"     ? "border-yellow-500/15" :
    "border-zinc-800/60";

  return (
    <div className={`flex items-start gap-4 rounded-2xl border p-4 transition-all hover:border-indigo-500/20 ${cardBorder}`}>
      {/* Countdown */}
      <div className={`flex flex-col items-center justify-center rounded-2xl border px-4 py-3 shrink-0 min-w-18 text-center ${cs.box}`}>
        {urgency === "today" ? (
          <span className={`text-lg font-black leading-none ${cs.num}`}>היום</span>
        ) : (
          <>
            <span className={`text-3xl font-black leading-none tabular-nums ${cs.num}`}>{days}</span>
            <span className={`text-[10px] font-bold mt-1 ${cs.sub}`}>ימים</span>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-base font-black text-white leading-tight">{exam.subject}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                <CalendarDays size={11} />{dateLabel}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                <Clock size={11} />{exam.time}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEdit}   className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-all"><Pencil size={13} /></button>
            <button onClick={onDelete} className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 size={13} /></button>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <ImportanceBadge imp={exam.importance} />
          {urgency === "critical" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-black text-red-300">
              <AlertCircle size={10} /> דחוף!
            </span>
          )}
          {urgency === "today" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-400/50 bg-red-400/20 px-2 py-0.5 text-[11px] font-black text-red-200">
              🔴 היום!
            </span>
          )}
        </div>

        {exam.notes && (
          <p className="mt-2 text-[11px] text-zinc-500 flex items-start gap-1 leading-relaxed">
            <FileText size={11} className="mt-0.5 shrink-0 text-zinc-600" />
            {exam.notes}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Exam modal ───────────────────────────────────────────────────────────────

type ExamForm = { subject: string; date: string; time: string; importance: ExamImportance; notes: string };
const EMPTY_EXAM_FORM: ExamForm = { subject: "", date: todayStr, time: "09:00", importance: "medium", notes: "" };

function ExamModal({ editing, onSave, onClose }: {
  editing: Exam | null; onSave: (e: Exam) => void; onClose: () => void;
}) {
  const [form, setForm] = useState<ExamForm>(
    editing
      ? { subject: editing.subject, date: editing.date, time: editing.time, importance: editing.importance, notes: editing.notes }
      : EMPTY_EXAM_FORM
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.subject.trim()) return;
    onSave({ id: editing?.id ?? genId(), subject: form.subject.trim(), date: form.date, time: form.time, importance: form.importance, notes: form.notes.trim() });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-900 border border-indigo-700/40 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-indigo-500/5 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <GraduationCap size={16} className="text-indigo-400" />
            <h3 className="text-base font-bold text-white">{editing ? "עריכת בחינה" : "הוספת בחינה"}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-zinc-400 mb-1 block">מקצוע</label>
            <input type="text" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="שם המקצוע..." className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors" required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-zinc-400 mb-1 block">תאריך</label>
              <input type="date" value={form.date} min={todayStr} max={EXAM_DEADLINE_STR} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-400 mb-1 block">שעה</label>
              <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-zinc-400 mb-2 block">חשיבות</label>
            <div className="grid grid-cols-3 gap-2">
              {(["high", "medium", "low"] as ExamImportance[]).map((imp) => {
                const m = EXAM_IMP_META[imp];
                return (
                  <button key={imp} type="button" onClick={() => setForm({ ...form, importance: imp })}
                    className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 border text-xs font-bold transition-all ${form.importance === imp ? `${m.bg} ${m.text} ${m.border}` : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"}`}>
                    <span className={`w-2 h-2 rounded-full ${m.dot}`} />{m.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-zinc-400 mb-1 block">הערות</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="מה צריך לחזור? אילו פרקים?" rows={3} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none" />
          </div>
          <button type="submit" className="w-full bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl py-2.5 text-sm font-black transition-colors">
            {editing ? "שמור שינויים" : "הוסף בחינה"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TimePlanningPage() {
  // ── Schedule state ──────────────────────────────────────────────────────────
  const [tasks, setTasks]         = useState<ScheduleTask[]>(SEED_TASKS);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [calYear, setCalYear]     = useState(TODAY.getFullYear());
  const [calMonth, setCalMonth]   = useState(TODAY.getMonth());
  const [filterCat, setFilterCat] = useState<Category | "all">("all");
  const [filterPri, setFilterPri] = useState<Priority | "all">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showTaskModal, setShowTaskModal]   = useState(false);
  const [editingTask,   setEditingTask]     = useState<ScheduleTask | null>(null);
  const [showCopyMenu,  setShowCopyMenu]    = useState(false);

  // ── Exams state ─────────────────────────────────────────────────────────────
  const [exams, setExams]             = useState<Exam[]>(SEED_EXAMS);
  const [examCalYear,  setExamCalYear]  = useState(TODAY.getFullYear());
  const [examCalMonth, setExamCalMonth] = useState(TODAY.getMonth());
  const [selectedExamDate, setSelectedExamDate] = useState(todayStr);
  const [showExamModal,  setShowExamModal]  = useState(false);
  const [editingExam,    setEditingExam]    = useState<Exam | null>(null);

  // ── Tab ─────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"schedule" | "exams">("schedule");

  // ─── Derived: schedule ──────────────────────────────────────────────────────

  const tasksByDate = useMemo(() => {
    const map: Record<string, ScheduleTask[]> = {};
    tasks.forEach((t) => { (map[t.date] ??= []).push(t); });
    return map;
  }, [tasks]);

  const todayTasks   = tasksByDate[todayStr] ?? [];
  const todayDone    = todayTasks.filter((t) => t.status === "completed");
  const todayHigh    = todayTasks.filter((t) => t.priority === "high");
  const todayFree    = todayTasks.filter((t) => t.category === "free-time");
  const todayProgress = todayTasks.length > 0 ? Math.round((todayDone.length / todayTasks.length) * 100) : 0;

  const selectedFiltered = useMemo(() =>
    (tasksByDate[selectedDate] ?? [])
      .filter((t) => filterCat === "all" || t.category === filterCat)
      .filter((t) => filterPri === "all" || t.priority === filterPri),
    [tasksByDate, selectedDate, filterCat, filterPri]
  );

  const selectedByTime  = [...selectedFiltered].sort((a, b) => a.time.localeCompare(b.time));
  const selectedMustDo  = selectedFiltered.filter((t) => t.priority === "high" && t.status === "pending").sort((a, b) => a.time.localeCompare(b.time));
  const selectedDone    = selectedFiltered.filter((t) => t.status === "completed");
  const selectedProgress = selectedFiltered.length > 0 ? Math.round((selectedDone.length / selectedFiltered.length) * 100) : 0;

  // ─── Derived: exams ─────────────────────────────────────────────────────────

  const examsByDate = useMemo(() => {
    const map: Record<string, Exam[]> = {};
    exams.forEach((e) => { (map[e.date] ??= []).push(e); });
    return map;
  }, [exams]);

  const upcomingExams = useMemo(() =>
    exams
      .filter((e) => e.date >= todayStr && e.date <= EXAM_DEADLINE_STR)
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)),
    [exams]
  );

  const nextExam         = upcomingExams[0] ?? null;
  const daysToNextExam   = nextExam ? daysUntil(nextExam.date) : null;
  const daysToDeadline   = daysUntil(EXAM_DEADLINE_STR);
  const examsThisWeek    = upcomingExams.filter((e) => daysUntil(e.date) <= 7).length;

  // ─── Handlers: schedule ─────────────────────────────────────────────────────

  function toggleTask(id: string) {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: t.status === "completed" ? "pending" : "completed" } : t));
  }
  function deleteTask(id: string) { setTasks((prev) => prev.filter((t) => t.id !== id)); }
  function saveTask(task: ScheduleTask) {
    setTasks((prev) => { const idx = prev.findIndex((t) => t.id === task.id); if (idx >= 0) { const n = [...prev]; n[idx] = task; return n; } return [...prev, task]; });
    setShowTaskModal(false); setEditingTask(null);
  }
  function openEditTask(task: ScheduleTask) { setEditingTask(task); setShowTaskModal(true); }
  function openAddTask()  { setEditingTask(null); setShowTaskModal(true); }

  function copyFromWeek(weeksAgo: number) {
    const srcDate  = fmtDate(addDays(new Date(selectedDate + "T00:00:00"), -7 * weeksAgo));
    const srcTasks = tasksByDate[srcDate] ?? [];
    if (srcTasks.length === 0) return;
    const copied: ScheduleTask[] = srcTasks.map((t) => ({ ...t, id: genId(), date: selectedDate, status: "pending" as TaskStatus }));
    setTasks((prev) => [...prev, ...copied]);
    setShowCopyMenu(false);
  }

  function prevCalMonth() { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }
  function nextCalMonth() { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }

  // ─── Handlers: exams ────────────────────────────────────────────────────────

  function deleteExam(id: string) { setExams((prev) => prev.filter((e) => e.id !== id)); }
  function saveExam(exam: Exam) {
    setExams((prev) => { const idx = prev.findIndex((e) => e.id === exam.id); if (idx >= 0) { const n = [...prev]; n[idx] = exam; return n; } return [...prev, exam]; });
    setShowExamModal(false); setEditingExam(null);
  }
  function openEditExam(exam: Exam) { setEditingExam(exam); setShowExamModal(true); }
  function openAddExam()  { setEditingExam(null); setShowExamModal(true); }

  function prevExamMonth() { if (examCalMonth === 0) { setExamCalMonth(11); setExamCalYear(y => y - 1); } else setExamCalMonth(m => m - 1); }
  function nextExamMonth() { if (examCalMonth === 11) { setExamCalMonth(0); setExamCalYear(y => y + 1); } else setExamCalMonth(m => m + 1); }

  // ─── Labels ─────────────────────────────────────────────────────────────────

  const selLabel = new Date(selectedDate + "T00:00:00").toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
  const deadlineLabel = EXAM_DEADLINE.toLocaleDateString("he-IL", { day: "numeric", month: "long" });

  // ─── Group upcoming exams by month ──────────────────────────────────────────

  const examsByMonth = useMemo(() => {
    const groups: { key: string; label: string; items: Exam[] }[] = [];
    upcomingExams.forEach((exam) => {
      const [y, m] = exam.date.split("-");
      const key = `${y}-${m}`;
      let grp = groups.find((g) => g.key === key);
      if (!grp) {
        const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("he-IL", { month: "long", year: "numeric" });
        grp = { key, label, items: [] };
        groups.push(grp);
      }
      grp.items.push(exam);
    });
    return groups;
  }, [upcomingExams]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 text-white" dir="rtl">

      {/* ── Top nav ── */}
      <nav className="sticky top-0 z-40 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 md:px-8 h-14">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft size={16} />
              <span className="text-sm font-bold hidden sm:block">חזרה</span>
            </Link>
            <div className="w-px h-5 bg-zinc-800" />
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-yellow-400" />
              <span className="text-sm font-black tracking-tight">תכנון זמן חכם</span>
            </div>
          </div>
          <button
            onClick={activeTab === "schedule" ? openAddTask : openAddExam}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition-colors
              ${activeTab === "exams" ? "bg-indigo-500 hover:bg-indigo-400 text-white" : "bg-white hover:bg-zinc-100 active:bg-zinc-200 text-zinc-950"}`}
          >
            <Plus size={14} />
            {activeTab === "exams" ? "הוסף בחינה" : "משימה חדשה"}
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-5">

        {/* ── Tab switcher ── */}
        <div className="flex gap-1.5 bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-1.5">
          <button
            onClick={() => setActiveTab("schedule")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all duration-200
              ${activeTab === "schedule" ? "bg-white text-zinc-950 shadow-md" : "text-zinc-500 hover:text-white"}`}
          >
            <Calendar size={15} />
            לוח זמנים יומי
          </button>
          <button
            onClick={() => setActiveTab("exams")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all duration-200
              ${activeTab === "exams" ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/25" : "text-zinc-500 hover:text-white"}`}
          >
            <GraduationCap size={15} />
            לוח בחינות
            {upcomingExams.length > 0 && (
              <span className={`text-[10px] font-black rounded-full px-1.5 py-0.5 ${activeTab === "exams" ? "bg-white/20" : "bg-zinc-800 text-zinc-400"}`}>
                {upcomingExams.length}
              </span>
            )}
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════
            TAB: DAILY SCHEDULE
        ══════════════════════════════════════════════════════ */}
        {activeTab === "schedule" && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="משימות היום"   value={todayTasks.length}  sub={`${todayDone.length} הושלמו`}   color="text-white"      icon={<Calendar size={15} className="text-zinc-500" />} />
              <StatCard label="עדיפות גבוהה"  value={todayHigh.length}   sub="דורשות קדימות"                   color="text-red-300"     icon={<Flame size={15} className="text-red-400" />} />
              <StatCard label="הושלמו"         value={todayDone.length}   sub={`${todayProgress}% מהיעד`}       color="text-green-300"   icon={<CheckCircle2 size={15} className="text-green-400" />} />
              <StatCard label="זמן חופשי"      value={todayFree.length}   sub="בלוקים היום"                     color="text-sky-300"     icon={<Coffee size={15} className="text-sky-400" />} />
            </div>

            {/* Progress */}
            <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-zinc-400">התקדמות יומית</span>
                <span className="text-xs font-black text-white">{todayProgress}%</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-linear-to-r from-green-500 to-emerald-400 transition-all duration-700" style={{ width: `${todayProgress}%` }} />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[11px] text-zinc-600">{todayDone.length} / {todayTasks.length} משימות</span>
                <span className="text-[11px] text-zinc-600">{todayTasks.length - todayDone.length} נותרו</span>
              </div>
            </div>

            {/* Main 2-col */}
            <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5">

              {/* Left: calendar + filters + legend */}
              <div className="space-y-4">
                <ScheduleCalendar year={calYear} month={calMonth} selectedDate={selectedDate} tasksByDate={tasksByDate} onSelect={setSelectedDate} onPrev={prevCalMonth} onNext={nextCalMonth} />

                {/* Filter accordion */}
                <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl overflow-hidden">
                  <button onClick={() => setShowFilters(v => !v)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/40 transition-colors">
                    <div className="flex items-center gap-2 text-sm font-bold text-zinc-300">
                      <Filter size={13} />פילטרים
                      {(filterCat !== "all" || filterPri !== "all") && <span className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <ChevronLeft size={14} className={`text-zinc-600 transition-transform duration-200 ${showFilters ? "-rotate-90" : "rotate-180"}`} />
                  </button>
                  {showFilters && (
                    <div className="px-4 pb-4 pt-3 space-y-4 border-t border-zinc-800/50">
                      <div>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">קטגוריה</p>
                        <div className="flex flex-wrap gap-1.5">
                          <FilterChip active={filterCat === "all"} onClick={() => setFilterCat("all")} label="הכל" />
                          {(Object.keys(CAT_META) as Category[]).map((c) => <FilterChip key={c} active={filterCat === c} onClick={() => setFilterCat(c)} label={CAT_META[c].label} />)}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">עדיפות</p>
                        <div className="flex flex-wrap gap-1.5">
                          <FilterChip active={filterPri === "all"} onClick={() => setFilterPri("all")} label="הכל" />
                          {(["high", "medium", "low"] as Priority[]).map((p) => <FilterChip key={p} active={filterPri === p} onClick={() => setFilterPri(p)} label={PRIORITY_META[p].label} />)}
                        </div>
                      </div>
                      {(filterCat !== "all" || filterPri !== "all") && (
                        <button onClick={() => { setFilterCat("all"); setFilterPri("all"); }} className="text-xs text-zinc-500 hover:text-white transition-colors underline underline-offset-2">נקה פילטרים</button>
                      )}
                    </div>
                  )}
                </div>

                {/* Category legend */}
                <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">קטגוריות</p>
                  <div className="grid grid-cols-2 gap-1">
                    {(Object.entries(CAT_META) as [Category, (typeof CAT_META)[Category]][]).map(([key, m]) => (
                      <button key={key} onClick={() => setFilterCat(filterCat === key ? "all" : key)}
                        className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-bold border transition-all ${filterCat === key ? `${m.bg} ${m.text} ${m.border}` : "border-transparent hover:border-zinc-800 text-zinc-500 hover:text-zinc-300"}`}>
                        <span className={filterCat === key ? m.text : "text-zinc-600"}>{m.icon}</span>{m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: schedule panel */}
              <div className="space-y-4">

                {/* Day header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-black text-white">{selLabel}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedDate === todayStr && <span className="text-xs font-bold text-yellow-400 flex items-center gap-1"><Zap size={11} />היום</span>}
                      <span className="text-xs text-zinc-600">
                        {selectedFiltered.length} משימות{selectedFiltered.length > 0 && ` · ${selectedProgress}% הושלמו`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Copy from previous week button */}
                    <button
                      onClick={() => setShowCopyMenu(v => !v)}
                      className={`flex items-center gap-1.5 text-xs font-bold border rounded-xl px-3 py-2 transition-all
                        ${showCopyMenu ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-300" : "text-zinc-500 hover:text-white border-zinc-800 hover:border-zinc-600"}`}
                    >
                      <History size={13} />
                      <span className="hidden sm:inline">ייבא שבוע</span>
                    </button>
                    <button onClick={openAddTask} className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 rounded-xl px-3 py-2 transition-all">
                      <Plus size={13} />הוסף
                    </button>
                  </div>
                </div>

                {/* Copy week panel */}
                {showCopyMenu && (
                  <CopyWeekPanel
                    selectedDate={selectedDate}
                    tasksByDate={tasksByDate}
                    onCopy={copyFromWeek}
                    onClose={() => setShowCopyMenu(false)}
                  />
                )}

                {/* Progress bar */}
                {selectedFiltered.length > 0 && (
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-linear-to-r from-green-500 to-emerald-400 transition-all duration-700" style={{ width: `${selectedProgress}%` }} />
                  </div>
                )}

                {/* Most Important */}
                {selectedMustDo.length > 0 && (
                  <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Flame size={14} className="text-red-400" />
                      <span className="text-sm font-black text-red-300">הכי חשוב היום</span>
                      <span className="text-[10px] bg-red-500/20 border border-red-500/30 text-red-300 rounded-full px-2 py-0.5 font-bold">{selectedMustDo.length}</span>
                    </div>
                    {selectedMustDo.map((task) => (
                      <TaskCard key={task.id} task={task} onToggle={() => toggleTask(task.id)} onEdit={() => openEditTask(task)} onDelete={() => deleteTask(task.id)} />
                    ))}
                  </div>
                )}

                {/* Full timeline */}
                <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock size={14} className="text-zinc-500" />
                    <span className="text-sm font-black text-zinc-300">לוח זמנים מלא</span>
                    {selectedByTime.length > 0 && <span className="text-[10px] text-zinc-600 mr-auto">ממוין לפי שעה</span>}
                  </div>
                  {selectedByTime.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <Calendar size={36} className="text-zinc-800" />
                      <p className="text-sm text-zinc-600 font-bold">אין משימות ביום זה</p>
                      <button onClick={openAddTask} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white border border-zinc-800 hover:border-zinc-600 rounded-xl px-4 py-2 transition-all">
                        <Plus size={13} />הוסף משימה ראשונה
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedByTime.map((task) => (
                        <TaskCard key={task.id} task={task} onToggle={() => toggleTask(task.id)} onEdit={() => openEditTask(task)} onDelete={() => deleteTask(task.id)} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Completed summary */}
                {selectedDone.length > 0 && (
                  <div className="bg-green-500/5 border border-green-500/15 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-green-400" />
                      <span className="text-xs font-bold text-green-400">{selectedDone.length} משימות הושלמו ביום זה</span>
                      <div className="mr-auto flex gap-0.5">
                        {selectedDone.slice(0, 5).map((t) => <span key={t.id} className={`w-2 h-2 rounded-full ${CAT_META[t.category].dot}`} />)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB: EXAMS CALENDAR
        ══════════════════════════════════════════════════════ */}
        {activeTab === "exams" && (
          <>
            {/* Exam stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="סה״כ בחינות"
                value={upcomingExams.length}
                sub={`עד ${deadlineLabel}`}
                color="text-indigo-300"
                icon={<GraduationCap size={15} className="text-indigo-400" />}
              />
              <StatCard
                label="השבוע"
                value={examsThisWeek}
                sub="בחינות ב-7 ימים"
                color={examsThisWeek > 0 ? "text-red-300" : "text-zinc-400"}
                icon={<AlertCircle size={15} className={examsThisWeek > 0 ? "text-red-400" : "text-zinc-600"} />}
              />
              <StatCard
                label="הבחינה הבאה"
                value={daysToNextExam !== null ? `${daysToNextExam}ד׳` : "—"}
                sub={nextExam ? nextExam.subject : "אין בחינות קרובות"}
                color={daysToNextExam !== null && daysToNextExam <= 3 ? "text-red-300" : "text-white"}
                icon={<Flame size={15} className={daysToNextExam !== null && daysToNextExam <= 7 ? "text-orange-400" : "text-zinc-600"} />}
              />
              <StatCard
                label="ימים ל-20 יוני"
                value={daysToDeadline}
                sub="מועד מבחנים"
                color="text-amber-300"
                icon={<CalendarDays size={15} className="text-amber-400" />}
              />
            </div>

            {/* Deadline progress bar */}
            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <GraduationCap size={14} className="text-indigo-400" />
                  <span className="text-xs font-bold text-indigo-300">עד תום תקופת הבחינות · 20 יוני</span>
                </div>
                <span className="text-xs font-black text-indigo-200">{daysToDeadline} ימים</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-linear-to-r from-indigo-600 to-violet-500 transition-all duration-700"
                  style={{ width: `${Math.max(2, Math.min(100, 100 - (daysToDeadline / 60) * 100))}%` }}
                />
              </div>
              <p className="text-[11px] text-zinc-600 mt-2">{upcomingExams.length} בחינות נותרו בתקופה זו</p>
            </div>

            {/* Main 2-col */}
            <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5">

              {/* Left: exam calendar */}
              <div className="space-y-4">
                <ExamCalendar
                  year={examCalYear}
                  month={examCalMonth}
                  selectedDate={selectedExamDate}
                  examsByDate={examsByDate}
                  onSelect={setSelectedExamDate}
                  onPrev={prevExamMonth}
                  onNext={nextExamMonth}
                />

                {/* Legend */}
                <div className="bg-zinc-900/60 border border-indigo-900/20 rounded-2xl p-4 space-y-3">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">מקרא ספירה לאחור</p>
                  {[
                    { color: "bg-red-500/20 border-red-500/30",    text: "text-red-300",    label: "1–3 ימים",  sub: "דחוף" },
                    { color: "bg-orange-500/20 border-orange-500/30", text: "text-orange-300", label: "4–7 ימים",  sub: "בקרוב" },
                    { color: "bg-yellow-500/20 border-yellow-500/30", text: "text-yellow-300", label: "8–14 ימים", sub: "מתקרב" },
                    { color: "bg-zinc-800 border-zinc-700/40",       text: "text-zinc-300",   label: "15+ ימים",  sub: "רחוק" },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-xl border flex items-center justify-center text-xs font-black ${row.color} ${row.text}`}>5</div>
                      <div>
                        <p className={`text-xs font-bold ${row.text}`}>{row.sub}</p>
                        <p className="text-[10px] text-zinc-600">{row.label}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add exam shortcut */}
                <button
                  onClick={openAddExam}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-500/30 py-3 text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-all"
                >
                  <Plus size={15} />הוסף בחינה חדשה
                </button>
              </div>

              {/* Right: exam list */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-white">בחינות קרובות</h2>
                  <span className="text-xs text-zinc-600">עד {deadlineLabel}</span>
                </div>

                {upcomingExams.length === 0 ? (
                  <div className="bg-zinc-900/60 border border-indigo-900/20 rounded-2xl flex flex-col items-center justify-center py-20 gap-3">
                    <GraduationCap size={40} className="text-zinc-800" />
                    <p className="text-sm text-zinc-600 font-bold">אין בחינות מתוכננות</p>
                    <button onClick={openAddExam} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-indigo-300 border border-zinc-800 hover:border-indigo-500/30 rounded-xl px-4 py-2 transition-all">
                      <Plus size={13} />הוסף בחינה ראשונה
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {examsByMonth.map((group) => (
                      <div key={group.key}>
                        {/* Month separator */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className="h-px flex-1 bg-indigo-900/30" />
                          <span className="text-xs font-black text-indigo-400/70 uppercase tracking-wider">{group.label}</span>
                          <div className="h-px flex-1 bg-indigo-900/30" />
                        </div>
                        <div className="space-y-3">
                          {group.items.map((exam) => (
                            <ExamCard
                              key={exam.id}
                              exam={exam}
                              onEdit={() => openEditExam(exam)}
                              onDelete={() => deleteExam(exam.id)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Modals ── */}
      {showTaskModal && (
        <TaskModal
          date={selectedDate}
          editing={editingTask}
          onSave={saveTask}
          onClose={() => { setShowTaskModal(false); setEditingTask(null); }}
        />
      )}
      {showExamModal && (
        <ExamModal
          editing={editingExam}
          onSave={saveExam}
          onClose={() => { setShowExamModal(false); setEditingExam(null); }}
        />
      )}
    </div>
  );
}
