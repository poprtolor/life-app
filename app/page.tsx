"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "./lib/supabase";
import {
  CheckCircle2,
  GraduationCap,
  School,
  Flame,
  Target,
  Trophy,
  Plus,
  Calendar as CalendarIcon,
  CalendarDays,
  ClipboardList,
  BookMarked,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Pencil,
  Play,
  Pause,
  Timer,
  X,
  BookOpen,
  Video,
  PenLine,
  ListTodo,
  Lock,
  Sparkles,
Dumbbell,


} from "lucide-react";

// --- Types ---
type PageKey = "habits" | "gym" | "university" | "school";
type HabitDayStatus = "done" | "missed" | "none";

type GymWorkoutDayStatus = "done" | "missed" | "none";

type GymWorkoutNote = {
  id: string;
  date: string;
  text: string;
};

type GymMuscle = {
  id: string;
  name: string;
  color: string;
  days: Record<string, GymWorkoutDayStatus>;
  notes: GymWorkoutNote[];
  level: number;
  targetPerWeek: number;
};

type GymData = {
  muscles: GymMuscle[];
};
type Habit = {
  id: number;
  name: string;
  description: string;
  category: string;
  days: Record<string, HabitDayStatus>;
  notes?: Record<string, string>;
};

type TaskType = "watch" | "read" | "exercise" | "general";

type Task = {
  id: string;
  title: string;
  type: TaskType;
  completed: boolean;
};

const TASK_TYPE_META: Record<
  TaskType,
  { label: string; chipClass: string }
> = {
  watch: {
    label: "צפייה",
    chipClass: "bg-sky-500/15 text-sky-200 border-sky-400/35",
  },
  read: {
    label: "קריאה",
    chipClass: "bg-violet-500/15 text-violet-200 border-violet-400/35",
  },
  exercise: {
    label: "תרגול",
    chipClass: "bg-rose-500/15 text-rose-200 border-rose-400/35",
  },
  general: {
    label: "כללי",
    chipClass: "bg-zinc-500/15 text-zinc-300 border-zinc-600/50",
  },
};

function taskTypeIcon(t: TaskType) {
  switch (t) {
    case "watch":
      return <Video size={14} className="shrink-0 text-sky-300" aria-hidden />;
    case "read":
      return <BookOpen size={14} className="shrink-0 text-violet-300" aria-hidden />;
    case "exercise":
      return <PenLine size={14} className="shrink-0 text-rose-300" aria-hidden />;
    default:
      return <ListTodo size={14} className="shrink-0 text-zinc-400" aria-hidden />;
  }
}

function coerceTaskType(v: string): TaskType {
  if (v === "watch" || v === "read" || v === "exercise" || v === "general") return v;
  return "general";
}

type Unit = {
  id: string;
  title: string;
  tasks: Task[];
  progress: number;
  completed: boolean;
  unlocked: boolean;
  difficulty?: "easy" | "medium" | "hard";
};

type Course = {
  id: number;
  name: string;
  color: string;
  units: Unit[];
  xp: number;
  importantDates: {
    id: number;
    title: string;
    date: string;
    type: "assignment" | "exam" | "other";
  }[];
};

type UniversityStudyEntry = {
  id: string;
  courseId: number;
  date: string;
  seconds: number;
};

type UniversityStudyStore = {
  entries: UniversityStudyEntry[];
};

function normalizeStudySeconds(value: unknown): number {
  const n = Number(value);

  if (!Number.isFinite(n) || n <= 0) return 0;

  // תיקון נתונים ישנים שנשמרו בטעות במילישניות במקום בשניות
  if (n > 86400) {
    return Math.round(n / 1000);
  }

  return Math.round(n);
}

function normalizeUniversityStudyStore(raw: unknown): UniversityStudyStore {
  if (!raw || typeof raw !== "object") {
    return { entries: [] };
  }

  const data = raw as { entries?: unknown[] };

  if (!Array.isArray(data.entries)) {
    return { entries: [] };
  }

  return {
    entries: data.entries
      .map((entry: any) => ({
        id: String(
          entry?.id ?? `st-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        ),
        courseId: Number(entry?.courseId ?? 0),
        date: String(entry?.date ?? ""),
        seconds: normalizeStudySeconds(entry?.seconds),
      }))
      .filter(
        (entry) =>
          entry.courseId > 0 &&
          /^\d{4}-\d{2}-\d{2}$/.test(entry.date) &&
          entry.seconds > 0
      ),
  };
}

// --- School Types ---
type SchoolAssignment = {
  id: string;
  title: string;
  dueDate: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
  type: "homework" | "reading" | "worksheet" | "project" | "study";
  subjectId: string;
};

type SchoolExam = {
  id: string;
  title: string;
  date: string;
  subjectId: string;
  status: "upcoming" | "completed";
  notes: string;
};

type SchoolNote = {
  id: string;
  title: string;
  content: string;
  subjectId: string;
  createdAt: string;
};

type SchoolSubject = {
  id: string;
  name: string;
  color: string;
  teacher?: string;
  progress: number;
};

type SchoolData = {
  subjects: SchoolSubject[];
  assignments: SchoolAssignment[];
  exams: SchoolExam[];
  notes: SchoolNote[];
};

type SchoolCountdown = {
  /** YYYY-MM-DD -> user marked "day passed" */
  markedPassedDays: Record<string, boolean>;
  /** Dates with no school (holidays, breaks), YYYY-MM-DD */
  noSchoolDays: string[];
};

function schoolDayTime(isoDate: string): number {
  return new Date(isoDate + "T12:00:00").getTime();
}

function isoTodayKey(): string {
  return new Date().toISOString().split("T")[0];
}

function isoKeyFromDate(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0).toISOString().split("T")[0];
}

function addDaysKey(iso: string, add: number): string {
  const dt = new Date(iso + "T12:00:00");
  dt.setDate(dt.getDate() + add);
  return isoKeyFromDate(dt);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 12, 0, 0);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 12, 0, 0);
}

type SchoolAgendaRow =
  | { kind: "exam"; id: string; at: number; exam: SchoolExam; subject: SchoolSubject }
  | {
      kind: "assignment";
      id: string;
      at: number;
      assignment: SchoolAssignment;
      subject: SchoolSubject;
    };

function buildSchoolAgenda(data: SchoolData, subjectId?: string | null): SchoolAgendaRow[] {
  const rows: SchoolAgendaRow[] = [];
  for (const exam of data.exams) {
    if (exam.status !== "upcoming") continue;
    if (subjectId && exam.subjectId !== subjectId) continue;
    const subject = data.subjects.find((s) => s.id === exam.subjectId);
    if (!subject) continue;
    rows.push({ kind: "exam", id: exam.id, at: schoolDayTime(exam.date), exam, subject });
  }
  for (const a of data.assignments) {
    if (a.completed) continue;
    if (subjectId && a.subjectId !== subjectId) continue;
    const subject = data.subjects.find((s) => s.id === a.subjectId);
    if (!subject) continue;
    rows.push({
      kind: "assignment",
      id: a.id,
      at: schoolDayTime(a.dueDate),
      assignment: a,
      subject,
    });
  }
  rows.sort((x, y) => x.at - y.at);
  return rows;
}

const SCHOOL_ASSIGNMENT_TYPE_HE: Record<SchoolAssignment["type"], string> = {
  homework: "שיעורי בית",
  reading: "קריאה",
  worksheet: "דף עבודה",
  project: "פרויקט",
  study: "לימוד",
};

// --- Sub-components ---
function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
        active
          ? "bg-zinc-100 text-zinc-950 shadow-lg shadow-white/5"
          : "text-zinc-500 hover:text-white hover:bg-zinc-900"
      }`}
    >
      <span
        className={`${
          active ? "text-zinc-950" : "group-hover:scale-110 transition-transform"
        }`}
      >
        {icon}
      </span>
      <span className="text-sm font-bold">{label}</span>
    </button>
  );
}

function QuickStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-2">
      <div className="flex items-center gap-2 text-zinc-500">
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <span className="text-sm font-black text-white">{value}</span>
    </div>
  );
}

function ChalkTally({ count }: { count: number }) {
  const blocks = Math.floor(count / 5);
  const rem = count % 5;
  const groupClass = "relative h-4 w-8";
  const lineClass = "absolute top-0 bottom-0 w-[2px] rounded-full bg-zinc-200/90";
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: blocks }).map((_, i) => (
        <div key={`b-${i}`} className={groupClass}>
          <span className={`${lineClass} left-1`} />
          <span className={`${lineClass} left-3`} />
          <span className={`${lineClass} left-5`} />
          <span className={`${lineClass} left-7`} />
          <span className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 rotate-[-18deg] rounded-full bg-zinc-200/90" />
        </div>
      ))}
      {rem > 0 && (
        <div className={groupClass}>
          {rem >= 1 && <span className={`${lineClass} left-1`} />}
          {rem >= 2 && <span className={`${lineClass} left-3`} />}
          {rem >= 3 && <span className={`${lineClass} left-5`} />}
          {rem >= 4 && <span className={`${lineClass} left-7`} />}
        </div>
      )}
    </div>
  );
}

function SchoolCountdownPanel({
  today,
  endDate,
  value,
  onChange,
  grossDaysLeft,
  netDaysLeft,
}: {
  today: Date;
  endDate: Date;
  value: SchoolCountdown;
  onChange: (next: SchoolCountdown) => void;
  grossDaysLeft: number;
  netDaysLeft: number;
}) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(today));
  const [newNoSchoolDay, setNewNoSchoolDay] = useState("");

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const rangeStartKey = isoKeyFromDate(today);
  const rangeEndKey = isoKeyFromDate(endDate);

  const firstDow = monthStart.getDay(); // 0 Sun
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - firstDow);

  const canPrev = startOfMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1)) >= startOfMonth(today);
  const canNext = startOfMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1)) <= startOfMonth(endDate);

  const noSchool = new Set(value.noSchoolDays);

  const togglePassed = (key: string) => {
    const isOn = !!value.markedPassedDays[key];
    onChange({
      ...value,
      markedPassedDays: { ...value.markedPassedDays, [key]: !isOn },
    });
  };

  const addNoSchool = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newNoSchoolDay)) return;
    onChange({
      ...value,
      noSchoolDays: Array.from(new Set([...value.noSchoolDays, newNoSchoolDay])).sort(),
    });
    setNewNoSchoolDay("");
  };

  const removeNoSchool = (key: string) => {
    onChange({ ...value, noSchoolDays: value.noSchoolDays.filter((d) => d !== key) });
  };

  return (
    <aside className="rounded-3xl border border-zinc-800 bg-zinc-950/55 p-5 shadow-[0_0_40px_rgba(0,0,0,0.35)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-widest text-zinc-500">עד 20 ביוני</div>
          <div className="mt-1 text-lg font-black text-white">לוח שנה + סימון ימים</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-zinc-500">נותר</div>
          <div className="text-base font-black text-white tabular-nums">{grossDaysLeft} ימים</div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-zinc-800 bg-black/25 p-3">
          <div className="text-[11px] font-bold text-zinc-500">ברוטו</div>
          <div className="mt-1 text-xl font-black text-white tabular-nums">{grossDaysLeft}</div>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-black/25 p-3">
          <div className="text-[11px] font-bold text-zinc-500">נטו לימודים</div>
          <div className="mt-1 text-xl font-black text-white tabular-nums">{netDaysLeft}</div>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => setViewMonth((m) => startOfMonth(new Date(m.getFullYear(), m.getMonth() - 1, 1)))}
          className={`rounded-xl border px-3 py-2 text-xs font-black transition-colors ${
            canPrev ? "border-zinc-800 bg-black/25 text-zinc-200 hover:bg-zinc-900/60" : "border-zinc-900 bg-black/10 text-zinc-700"
          }`}
        >
          חודש קודם
        </button>
        <div className="text-sm font-black text-white">
          {monthStart.toLocaleDateString("he-IL", { month: "long", year: "numeric" })}
        </div>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => setViewMonth((m) => startOfMonth(new Date(m.getFullYear(), m.getMonth() + 1, 1)))}
          className={`rounded-xl border px-3 py-2 text-xs font-black transition-colors ${
            canNext ? "border-zinc-800 bg-black/25 text-zinc-200 hover:bg-zinc-900/60" : "border-zinc-900 bg-black/10 text-zinc-700"
          }`}
        >
          חודש הבא
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-[10px] font-bold text-zinc-600 mb-2">
        {["א", "ב", "ג", "ד", "ה", "ו", "ש"].map((d) => (
          <div key={d} className="text-center">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 42 }).map((_, idx) => {
          const d = new Date(gridStart);
          d.setDate(d.getDate() + idx);
          d.setHours(12, 0, 0, 0);
          const key = dateKeyFromDate(d);

          const inMonth = d >= monthStart && d <= monthEnd;
          const inRange = key >= rangeStartKey && key <= rangeEndKey;
          const dayOfWeek = d.getDay();
          const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
          const isNoSchool = noSchool.has(key);
          const isToday = key === rangeStartKey;
          const isMarked = !!value.markedPassedDays[key];

          const disabled = !inMonth || !inRange;
          const canToggle = !disabled && key <= rangeStartKey;

          return (
            <button
              key={key}
              type="button"
              disabled={!canToggle}
              onClick={() => togglePassed(key)}
              className={[
                "relative h-12 rounded-xl border transition-colors overflow-hidden",
                disabled
                  ? "border-transparent bg-transparent"
                  : isToday
                    ? "border-blue-500 bg-blue-500/10"
                    : isNoSchool
                      ? "border-amber-500/30 bg-amber-500/10"
                      : isWeekend
                        ? "border-zinc-800 bg-zinc-950/70"
                        : "border-zinc-800 bg-black/25 hover:bg-zinc-900/50",
                canToggle ? "cursor-pointer" : "cursor-not-allowed opacity-60",
              ].join(" ")}
              title={key}
            >
              <div className="absolute top-1 left-1 text-[10px] font-black text-zinc-300">{d.getDate()}</div>
              {isMarked && (
                <div className="absolute inset-0 grid place-items-center">
                  <ChalkTally count={5} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-zinc-800 bg-black/25 p-4">
        <div className="mb-2 text-xs font-black uppercase tracking-widest text-zinc-600">ימים בלי לימודים</div>
        <div className="flex gap-2">
          <input
            type="date"
            value={newNoSchoolDay}
            onChange={(e) => setNewNoSchoolDay(e.target.value)}
            className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/60"
          />
          <button
            type="button"
            onClick={addNoSchool}
            className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-black text-amber-950 hover:bg-amber-400 transition-colors"
          >
            הוסף
          </button>
        </div>
        {value.noSchoolDays.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {value.noSchoolDays.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => removeNoSchool(d)}
                className="rounded-full border border-zinc-700 bg-zinc-950/40 px-3 py-1 text-[11px] font-bold text-zinc-300 hover:border-amber-500/40"
                title="לחץ להסרה"
              >
                {d}
              </button>
            ))}
          </div>
        )}
        <p className="mt-3 text-[11px] text-zinc-600">
          נטו מחושב כימים בלי שישי/שבת ובלי התאריכים כאן.
        </p>
      </div>
    </aside>
  );
}

// --- Mock Data ---
const initialHabits: Habit[] = [];
const initialGymData: GymData = {
  muscles: [
    {
      id: "chest",
      name: "חזה",
      color: "#ef4444",
      days: {},
      notes: [],
      level: 1,
      targetPerWeek: 2,
    },
    {
      id: "back",
      name: "גב",
      color: "#3b82f6",
      days: {},
      notes: [],
      level: 1,
      targetPerWeek: 2,
    },
    {
      id: "shoulders",
      name: "כתפיים",
      color: "#f59e0b",
      days: {},
      notes: [],
      level: 1,
      targetPerWeek: 2,
    },
    {
      id: "arms",
      name: "ידיים",
      color: "#22c55e",
      days: {},
      notes: [],
      level: 1,
      targetPerWeek: 2,
    },
    {
      id: "legs",
      name: "רגליים",
      color: "#8b5cf6",
      days: {},
      notes: [],
      level: 1,
      targetPerWeek: 2,
    },
    {
      id: "abs",
      name: "בטן",
      color: "#06b6d4",
      days: {},
      notes: [],
      level: 1,
      targetPerWeek: 3,
    },
  ],
};

// --- Helpers ---
function getMonthDays(year: number, month: number) {
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const days: Array<
    | {
        key: string;
        dayNumber: number;
        isFuture: boolean;
        isToday: boolean;
      }
    | null
  > = [];

  for (let i = 0; i < (firstDayOfMonth + 1) % 7; i++) {
    days.push(null);
  }

  for (let i = 1; i <= totalDays; i++) {
    const date = new Date(year, month, i);
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(
      2,
      "0"
    )}`;

    days.push({
      key,
      dayNumber: i,
      isFuture: date > new Date(new Date().setHours(23, 59, 59, 999)),
      isToday: date.toDateString() === new Date().toDateString(),
    });
  }

  return days;
}

function dateKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function getLast7DateKeys(): string[] {
  const out: string[] = [];
  const base = new Date();
  base.setHours(12, 0, 0, 0);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    out.push(dateKeyFromDate(d));
  }
  return out;
}

function secondsForCourseOnDate(
  entries: UniversityStudyEntry[],
  courseId: number,
  dateKey: string
): number {
  return entries
    .filter((e) => e.courseId === courseId && e.date === dateKey)
    .reduce((sum, e) => sum + normalizeStudySeconds(e.seconds), 0);
}

function secondsAllCoursesOnDate(entries: UniversityStudyEntry[], dateKey: string): number {
  return entries
    .filter((e) => e.date === dateKey)
    .reduce((sum, e) => sum + normalizeStudySeconds(e.seconds), 0);
}

/** זמן לימוד בתצוגת מספרים בלבד: MM:SS או HH:MM:SS */
function formatStudyDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s <= 0) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const SS = String(sec).padStart(2, "0");
  const MM = String(m).padStart(2, "0");
  if (h > 0) {
    const HH = String(h).padStart(2, "0");
    return `${HH}:${MM}:${SS}`;
  }
  return `${MM}:${SS}`;
}

function weekBoundsSunday(): { start: Date; end: Date } {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const day = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function sumSecondsForCourseInWeek(
  entries: UniversityStudyEntry[],
  courseId: number,
  start: Date,
  end: Date
): number {
  return entries
    .filter((e) => e.courseId === courseId)
    .filter((e) => {
      const t = new Date(e.date + "T12:00:00").getTime();
      return t >= start.getTime() && t <= end.getTime();
    })
    .reduce((a, e) => a + normalizeStudySeconds(e.seconds), 0);
}

function sumSecondsAllInWeek(entries: UniversityStudyEntry[], start: Date, end: Date): number {
  return entries
    .filter((e) => {
      const t = new Date(e.date + "T12:00:00").getTime();
      return t >= start.getTime() && t <= end.getTime();
    })
    .reduce((a, e) => a + normalizeStudySeconds(e.seconds), 0);
}

function sumAllSecondsForCourse(entries: UniversityStudyEntry[], courseId: number): number {
  return entries
    .filter((e) => e.courseId === courseId)
    .reduce((a, e) => a + normalizeStudySeconds(e.seconds), 0);
}

function UniversityStudyTimerFullPage({
  date,
  courseName,
  accentColor,
  onClose,
  onSave,
}: {
  date: string;
  courseName: string;
  accentColor: string;
  onClose: () => void;
  onSave: (seconds: number) => void;
}) {
  const [running, setRunning] = useState(false);
  const [baseMs, setBaseMs] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running || startAtRef.current === null) return;

    const tick = () => {
      setElapsedMs(baseMs + Date.now() - startAtRef.current!);
    };

    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [running, baseMs]);

  const displaySec = Math.max(0, Math.floor(elapsedMs / 1000));

  const handleStart = () => {
    if (!running) {
      startAtRef.current = Date.now();
      setRunning(true);
    }
  };

  const handlePause = () => {
    if (running && startAtRef.current !== null) {
      const nextMs = baseMs + (Date.now() - startAtRef.current);
      setBaseMs(nextMs);
      setElapsedMs(nextMs);
      startAtRef.current = null;
      setRunning(false);
    }
  };

  const handleSave = () => {
    const currentMs =
      running && startAtRef.current !== null
        ? baseMs + (Date.now() - startAtRef.current)
        : elapsedMs;
    const sec = Math.floor(currentMs / 1000);
    if (sec <= 0) return;

    startAtRef.current = null;
    setRunning(false);
    setBaseMs(0);
    setElapsedMs(0);
    onSave(sec);
  };

  const tryClose = () => {
    const currentMs =
      running && startAtRef.current !== null
        ? baseMs + (Date.now() - startAtRef.current)
        : elapsedMs;
    if (currentMs >= 1000 && !confirm("יש זמן שלא נשמר. לצאת בלי לשמור?")) return;

    startAtRef.current = null;
    setRunning(false);
    setBaseMs(0);
    setElapsedMs(0);
    onClose();
  };

  const h = Math.floor(displaySec / 3600);
  const m = Math.floor((displaySec % 3600) / 60);
  const s = displaySec % 60;
  const clock =
    h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6 text-white"
      style={{
        background: `linear-gradient(165deg, #030303 0%, #0c0c0c 45%, color-mix(in srgb, ${accentColor} 28%, #050505) 100%)`,
      }}
    >
      <button
        type="button"
        onClick={tryClose}
        className="absolute top-6 end-6 p-3 rounded-2xl bg-zinc-900/90 border border-zinc-700 hover:bg-zinc-800 transition-colors"
        aria-label="סגור"
      >
        <X size={22} />
      </button>

      <div className="text-center max-w-lg w-full space-y-3 mb-10">
        <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">טיימר לימוד</p>
        <h2 className="text-2xl md:text-3xl font-black text-white">{courseName}</h2>
        <p className="text-zinc-400 text-lg">{dateLabel}</p>
      </div>

      <div
        className="relative mb-14 flex h-64 w-64 md:h-80 md:w-80 items-center justify-center rounded-full border-4 shadow-[0_0_80px_rgba(0,0,0,0.5)]"
        style={{ borderColor: accentColor, boxShadow: `0 0 60px ${accentColor}44` }}
      >
        <div className="absolute inset-4 rounded-full border border-zinc-800/80" />
        <span
          className="relative z-10 font-mono text-5xl md:text-6xl font-black tracking-tight tabular-nums"
          style={{ color: accentColor }}
        >
          {clock}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
        {!running ? (
          <button
            type="button"
            onClick={handleStart}
            className="flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-lg bg-emerald-500 text-emerald-950 hover:bg-emerald-400 transition-all shadow-[0_0_30px_rgba(34,197,94,0.35)]"
          >
            <Play size={22} fill="currentColor" />
            התחל
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePause}
            className="flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-lg bg-amber-500 text-amber-950 hover:bg-amber-400 transition-all shadow-[0_0_30px_rgba(245,158,11,0.35)]"
          >
            <Pause size={22} />
            השהה
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={displaySec <= 0}
        className="w-full max-w-md py-5 rounded-2xl font-black text-lg border-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
        style={{
          borderColor: accentColor,
          color: "#fff",
          background: `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 35%, transparent), #0a0a0a)`,
        }}
      >
        סיום לימוד ושמירה
      </button>
      <p className="mt-4 text-center text-sm text-zinc-500 max-w-md">
        הזמן יתווסף ליום שבחרת בלוח השנה של הקורס. אפשר לצבור כמה רצפים באותו יום.
      </p>
    </div>
  );
}

function calculateStreak(days: Record<string, HabitDayStatus>) {
  const sortedKeys = Object.keys(days).sort().reverse();
  let streak = 0;

  for (const key of sortedKeys) {
    if (days[key] === "done") streak++;
    else if (days[key] === "missed") break;
  }

  return streak;
}

function calculateGymStreak(days: Record<string, GymWorkoutDayStatus>) {
  const sortedKeys = Object.keys(days).sort().reverse();
  let streak = 0;

  for (const key of sortedKeys) {
    if (days[key] === "done") streak++;
    else if (days[key] === "missed") break;
  }

  return streak;
}

function getCurrentWeekDateKeys(): string[] {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const day = now.getDay();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - day);

  const keys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    keys.push(dateKeyFromDate(d));
  }
  return keys;
}

function getGymWeeklyStats(muscle: GymMuscle) {
  const weekKeys = getCurrentWeekDateKeys();
  const completed = weekKeys.filter((key) => muscle.days[key] === "done").length;
  const percent =
    muscle.targetPerWeek > 0
      ? Math.min(100, Math.round((completed / muscle.targetPerWeek) * 100))
      : 0;

  return {
    completed,
    target: muscle.targetPerWeek,
    percent,
  };
}

function getGymMonthlyStats(muscle: GymMuscle, year: number, month: number) {
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
  const monthKeys = Object.keys(muscle.days).filter((key) => key.startsWith(prefix));

  const doneCount = monthKeys.filter((key) => muscle.days[key] === "done").length;
  const missedCount = monthKeys.filter((key) => muscle.days[key] === "missed").length;

  return {
    doneCount,
    missedCount,
  };
}

function getMostActiveGymMuscle(muscles: GymMuscle[]) {
  if (muscles.length === 0) return null;

  return [...muscles].sort((a, b) => {
    const aDone = Object.values(a.days).filter((v) => v === "done").length;
    const bDone = Object.values(b.days).filter((v) => v === "done").length;
    return bDone - aDone;
  })[0];
}

function normalizeCourse(course: any): Course {
  let units: Unit[] = course.units || [];
  let xp: number = course.xp || 0;

  // Migrate old topics to units if present
  if (course.topics && course.topics.length > 0 && units.length === 0) {
    units = course.topics.map((topic: any, index: number) => ({
      id: `unit-${index + 1}`,
      title: topic.title, // Use the actual topic title instead of "Unit X"
      tasks: [
        {
          id: `task-${topic.id}`,
          title: topic.title,
          type: "general",
          completed: false,
        },
      ],
      progress: 0,
      completed: false,
      unlocked: index === 0, // Only first unit unlocked
    }));
  }

  // Add mock data if no units
  if (units.length === 0) {
    units = [
      {
        id: "unit-1",
        title: "Unit 1",
        tasks: [
          { id: "task-1-1", title: "Watch lecture 1", type: "watch", completed: false },
          { id: "task-1-2", title: "Read book until page 80", type: "read", completed: false },
          { id: "task-1-3", title: "Solve basic exercises", type: "exercise", completed: false },
        ],
        progress: 0,
        completed: false,
        unlocked: true,
      },
      {
        id: "unit-2",
        title: "Unit 2",
        tasks: [
          { id: "task-2-1", title: "Watch lectures 2 and 3", type: "watch", completed: false },
          { id: "task-2-2", title: "Read next chapter", type: "read", completed: false },
          { id: "task-2-3", title: "Solve intermediate exercises", type: "exercise", completed: false },
        ],
        progress: 0,
        completed: false,
        unlocked: false,
      },
    ];
  }

  units = units.map((u) => ({
    ...u,
    tasks: (u.tasks || []).map((t: Task) => ({
      ...t,
      type: coerceTaskType(String(t.type ?? "general")),
    })),
  }));

  units = normalizeUnitsState(units);

  return {
    ...course,
    units,
    xp,
    importantDates: course.importantDates || [],
  };
}

// --- Helper Functions ---
/** סיום יחידה: סימון ידני, או כל המשימות הושלמו (לא נחשב סיום ליחידה ריקה בלי סימון) */
function deriveUnitCompleted(u: Unit, tasks: Task[]): boolean {
  if (u.completed) return true;
  if (tasks.length === 0) return false;
  return tasks.every((t) => t.completed);
}

function isUnitCompleted(unit: Unit): boolean {
  return deriveUnitCompleted(unit, unit.tasks);
}

function isUnitUnlockedAtIndex(units: Unit[], index: number): boolean {
  if (index <= 0) return true;
  return units.slice(0, index).every((prev) => deriveUnitCompleted(prev, prev.tasks));
}

function normalizeUnitsState(units: Unit[]): Unit[] {
  const derived = units.map((u) => ({
    ...u,
    progress: calculateUnitProgress(u),
    completed: deriveUnitCompleted(u, u.tasks),
  }));
  return derived.map((u, index) => ({
    ...u,
    unlocked: isUnitUnlockedAtIndex(derived, index),
  }));
}

function calculateUnitProgress(unit: Unit): number {
  if (unit.tasks.length === 0) return 0;
  const completedTasks = unit.tasks.filter(task => task.completed).length;
  return Math.round((completedTasks / unit.tasks.length) * 100);
}

function calculateTotalXP(units: Unit[]): number {
  let totalXP = 0;
  units.forEach(unit => {
    unit.tasks.forEach(task => {
      if (task.completed) totalXP += 10; // 10 XP per task
    });
    if (isUnitCompleted(unit)) totalXP += 50; // 50 bonus XP per completed unit
  });
  return totalXP;
}
async function saveAllData(userId: string, payload: any) {
  const { data, error } = await supabase
    .from("profiles_data1")
    .upsert(
      {
        user_id: userId,
        data: payload,
      },
      {
        onConflict: "user_id",
      }
    )
    .select();

  console.log("SAVE data:", data);
  console.log("SAVE error:", error);

  return { data, error };
}

async function loadAllData(userId: string) {
  const { data, error } = await supabase
    .from("profiles_data1")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();

  console.log("LOAD data:", data);
  console.log("LOAD error:", error);

  if (error) return null;
  return data?.data ?? null;
}
const DEMO_USER_ID = "ronen-local-001";

// --- Main Component ---
export default function Home() {
  const [activePage, setActivePage] = useState<PageKey>("habits");
  const [selectedHabitId, setSelectedHabitId] = useState<number | null>(1);
  const [selectedHabitDayKey, setSelectedHabitDayKey] = useState<string | null>(null);
  const [habits, setHabits] = useState<Habit[]>(initialHabits);
  const [newHabitName, setNewHabitName] = useState("");
  const [editingHabitId, setEditingHabitId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const [courses, setCourses] = useState<Course[]>([]);
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseColor, setNewCourseColor] = useState("#3b82f6");
  const [editingCourseId, setEditingCourseId] = useState<number | null>(null);
  const [editingCourseName, setEditingCourseName] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);

  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [courseTab, setCourseTab] = useState<"learning" | "dates" | "study-time">("learning");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskType, setNewTaskType] = useState<"watch" | "read" | "exercise" | "general">("general");
  const [addingTaskToUnit, setAddingTaskToUnit] = useState<string | null>(null);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingUnitTitle, setEditingUnitTitle] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState("");
  const [editingTaskType, setEditingTaskType] = useState<"watch" | "read" | "exercise" | "general">("general");
  const [newDateTitle, setNewDateTitle] = useState("");
  const [newDateValue, setNewDateValue] = useState("");
  const [newDateType, setNewDateType] = useState<"assignment" | "exam" | "other">("assignment");

  // Task drag-and-drop state
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [draggingFromUnitId, setDraggingFromUnitId] = useState<string | null>(null);
  const [isActiveDrag, setIsActiveDrag] = useState(false);
  const [hoveredTargetTaskId, setHoveredTargetTaskId] = useState<string | null>(null);
  const longPressRef = useRef<NodeJS.Timeout | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [gymData, setGymData] = useState<GymData>(initialGymData);
const [selectedGymMuscleId, setSelectedGymMuscleId] = useState<string | null>(null);
const [gymNoteText, setGymNoteText] = useState("");
const [gymCurrentMonth, setGymCurrentMonth] = useState(new Date().getMonth());
const [gymCurrentYear, setGymCurrentYear] = useState(new Date().getFullYear());
const [hasLoadedData, setHasLoadedData] = useState(false);

const addSchoolAssignment = () => {
  if (!selectedSchoolSubjectId || !newAssignmentTitle.trim() || !newAssignmentDue) return;

  const newAssignment: SchoolAssignment = {
    id: `sa-${Date.now()}`,
    title: newAssignmentTitle.trim(),
    dueDate: newAssignmentDue,
    completed: false,
    priority: newAssignmentPriority,
    type: newAssignmentType,
    subjectId: selectedSchoolSubjectId,
  };

  setSchoolData((prev) => ({
    ...prev,
    assignments: [newAssignment, ...prev.assignments],
  }));

  setNewAssignmentTitle("");
  setNewAssignmentDue("");
  setNewAssignmentPriority("medium");
  setNewAssignmentType("homework");
};

const addSchoolExam = () => {
  if (!selectedSchoolSubjectId || !newExamTitle.trim() || !newExamDate) return;

  const newExam: SchoolExam = {
    id: `se-${Date.now()}`,
    title: newExamTitle.trim(),
    date: newExamDate,
    subjectId: selectedSchoolSubjectId,
    status: "upcoming",
    notes: newExamNotes.trim(),
  };

  setSchoolData((prev) => ({
    ...prev,
    exams: [newExam, ...prev.exams],
  }));

  setNewExamTitle("");
  setNewExamDate("");
  setNewExamNotes("");
};

const toggleAssignmentCompleted = (assignmentId: string) => {
  setSchoolData((prev) => ({
    ...prev,
    assignments: prev.assignments.map((a) =>
      a.id === assignmentId ? { ...a, completed: !a.completed } : a
    ),
  }));
};

const deleteSchoolAssignment = (assignmentId: string) => {
  setSchoolData((prev) => ({
    ...prev,
    assignments: prev.assignments.filter((a) => a.id !== assignmentId),
  }));
};

const deleteSchoolExam = (examId: string) => {
  setSchoolData((prev) => ({
    ...prev,
    exams: prev.exams.filter((e) => e.id !== examId),
  }));
};










// (school countdown calendar constants are defined below, after state)
  // School Data State
  const [schoolData, setSchoolData] = useState<SchoolData>({
    subjects: [],
    assignments: [],
    exams: [],
    notes: [],
  });
  const [schoolCountdown, setSchoolCountdown] = useState<SchoolCountdown>({
    markedPassedDays: {},
    noSchoolDays: [],
  });
  const [selectedSchoolSubjectId, setSelectedSchoolSubjectId] = useState<string | null>(null);
  const [newAssignmentTitle, setNewAssignmentTitle] = useState("");
  const [newAssignmentDue, setNewAssignmentDue] = useState("");
  const [newAssignmentPriority, setNewAssignmentPriority] = useState<"low" | "medium" | "high">("medium");
  const [newAssignmentType, setNewAssignmentType] = useState<"homework" | "reading" | "worksheet" | "project" | "study">("homework");
  const [newExamTitle, setNewExamTitle] = useState("");
  const [newExamDate, setNewExamDate] = useState("");
  const [newExamNotes, setNewExamNotes] = useState("");
  const [newSchoolHubSubjectId, setNewSchoolHubSubjectId] = useState<string>("");
  const [schoolHubTab, setSchoolHubTab] = useState<
    "overview" | "countdown" | "exams" | "homework" | "topics"
  >("overview");
  const [schoolSubjectTab, setSchoolSubjectTab] = useState<
    "schedule" | "homework" | "exams" | "notes"
  >("schedule");
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  }, []);

  const schoolEndDate = useMemo(() => {
    const d = new Date(today.getFullYear(), 5, 20); // 20 ביוני
    d.setHours(12, 0, 0, 0);
    return d;
  }, [today.getFullYear()]);

  const msPerDay = 1000 * 60 * 60 * 24;

  const grossDaysLeft = useMemo(() => {
    const diff = Math.floor((schoolEndDate.getTime() - today.getTime()) / msPerDay);
    return diff >= 0 ? diff + 1 : 0;
  }, [today.getTime(), schoolEndDate.getTime()]);

  const netDaysLeft = useMemo(() => {
    const noSchool = new Set(schoolCountdown.noSchoolDays);
    let count = 0;
    const cursor = new Date(today);

    while (cursor <= schoolEndDate) {
      const day = cursor.getDay(); // 0=Sunday, 6=Saturday
      const key = dateKeyFromDate(cursor);
      const isWeekend = day === 5 || day === 6; // Fri/Sat
      const isNoSchool = noSchool.has(key);

      if (!isWeekend && !isNoSchool) count++;

      cursor.setDate(cursor.getDate() + 1);
    }

    return Math.max(0, count);
  }, [today.getTime(), schoolEndDate.getTime(), schoolCountdown.noSchoolDays]);

  const schoolTimelineDays = useMemo(() => {
    const days: Array<{
      key: string;
      label: string;
      isPassed: boolean;
      isToday: boolean;
      isWeekend: boolean;
    }> = [];

    const cursor = new Date(today);
    cursor.setHours(12, 0, 0, 0);

    while (cursor <= schoolEndDate) {
      const key = dateKeyFromDate(cursor);
      const day = cursor.getDay();

      days.push({
        key,
        label: `${cursor.getDate()}/${cursor.getMonth() + 1}`,
        isPassed: cursor.getTime() < today.getTime(),
        isToday: cursor.toDateString() === today.toDateString(),
        isWeekend: day === 5 || day === 6,
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    return days;
  }, [today.getTime(), schoolEndDate.getTime()]);

  const [universityStudy, setUniversityStudy] = useState<UniversityStudyStore>({ entries: [] });
  const [uniStudyMonth, setUniStudyMonth] = useState(new Date().getMonth());
  const [uniStudyYear, setUniStudyYear] = useState(new Date().getFullYear());
  const [studyTimerOpen, setStudyTimerOpen] = useState<{
    date: string;
    courseId: number;
  } | null>(null);

  const schoolAgendaAll = useMemo(() => buildSchoolAgenda(schoolData), [schoolData]);

  useEffect(() => {
    if (selectedSchoolSubjectId) setSchoolSubjectTab("schedule");
  }, [selectedSchoolSubjectId]);

  const monthDays = useMemo(
    () => getMonthDays(currentYear, currentMonth),
    [currentYear, currentMonth]
  );
  const uniStudyMonthDays = useMemo(
    () => getMonthDays(uniStudyYear, uniStudyMonth),
    [uniStudyYear, uniStudyMonth]
  );

  

  



  

  


 

  // Cleanup long-press timer on unmount or when dragging ends
  useEffect(() => {
    return () => {
      if (longPressRef.current) {
        clearTimeout(longPressRef.current);
      }
    };
  }, []);





useEffect(() => {
  let isMounted = true;

  async function initData() {
    const res = await loadAllData(DEMO_USER_ID);

    if (!isMounted) return;

    if (res) {
      setGymData(res.gymData || initialGymData);
      setHabits(Array.isArray(res.habits) ? res.habits : []);
      setCourses(
        Array.isArray(res.courses)
          ? res.courses.map((c: any) => normalizeCourse(c))
          : []
      );
      setSchoolData(
        res.schoolData && typeof res.schoolData === "object"
          ? res.schoolData
          : {
              subjects: [],
              assignments: [],
              exams: [],
              notes: [],
            }
      );
      setSchoolCountdown(
        res.schoolCountdown && typeof res.schoolCountdown === "object"
          ? {
              markedPassedDays:
                res.schoolCountdown.markedPassedDays &&
                typeof res.schoolCountdown.markedPassedDays === "object"
                  ? res.schoolCountdown.markedPassedDays
                  : {},
              noSchoolDays: Array.isArray(res.schoolCountdown.noSchoolDays)
                ? res.schoolCountdown.noSchoolDays
                : [],
            }
          : { markedPassedDays: {}, noSchoolDays: [] }
      );
      setUniversityStudy(
        res.universityStudy
          ? normalizeUniversityStudyStore(res.universityStudy)
          : { entries: [] }
      );
    } else {
      setGymData(initialGymData);
      setHabits([]);
      setCourses([]);
      setSchoolData({
        subjects: [],
        assignments: [],
        exams: [],
        notes: [],
      });
      setSchoolCountdown({ markedPassedDays: {}, noSchoolDays: [] });
      setUniversityStudy({ entries: [] });
    }

    setHasLoadedData(true);
  }

  initData();

  return () => {
    isMounted = false;
  };
}, []);
useEffect(() => {
  if (!hasLoadedData) return;

  const payload = {
    habits,
    courses,
     gymData,
    schoolData,
    schoolCountdown,
    universityStudy,
  };

  saveAllData(DEMO_USER_ID, payload);
}, [hasLoadedData, habits, gymData, courses, schoolData, schoolCountdown, universityStudy]);

  const initializeSchoolData = () => {
    const mockSubjects: SchoolSubject[] = [
      { id: "math", name: "מתמטיקה", color: "#3b82f6", teacher: "מר כהן", progress: 75 },
      { id: "english", name: "אנגלית", color: "#10b981", teacher: "Mrs. Smith", progress: 60 },
      { id: "hebrew", name: "לשון עברית", color: "#f59e0b", teacher: "גב' לוי", progress: 80 },
      { id: "history", name: "היסטוריה", color: "#8b5cf6", teacher: "מר ברק", progress: 70 },
      { id: "civic", name: "אזרחות", color: "#ec4899", teacher: "גב' דוד", progress: 65 },
      { id: "bible", name: "תנ\"ך", color: "#06b6d4", teacher: "מר יצחק", progress: 72 },
    ];

    const mockAssignments: SchoolAssignment[] = [
      {
        id: "a1",
        title: "תרגיל עמוד 45-47",
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        completed: false,
        priority: "high",
        type: "homework",
        subjectId: "math",
      },
      {
        id: "a2",
        title: "קראת compelling argument essay",
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        completed: false,
        priority: "medium",
        type: "reading",
        subjectId: "english",
      },
      {
        id: "a3",
        title: "ניתוח טקסט בן-גוריון",
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        completed: false,
        priority: "medium",
        type: "homework",
        subjectId: "hebrew",
      },
    ];

    const mockExams: SchoolExam[] = [
      {
        id: "e1",
        title: "מבחן מתמטיקה - פרק א",
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        subjectId: "math",
        status: "upcoming",
        notes: "פרקים 1-3, שאלות 1-20",
      },
      {
        id: "e2",
        title: "בחינת היסטוריה",
        date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        subjectId: "history",
        status: "upcoming",
        notes: "מלחמת העולם השנייה עד סוף 1943",
      },
    ];

    const mockNotes: SchoolNote[] = [
      {
        id: "n1",
        title: "נוסחאות חשובות",
        content: "השיפוע: m = (y2-y1)/(x2-x1)\nנוסחת קו: y = mx + b",
        subjectId: "math",
        createdAt: new Date().toISOString(),
      },
    ];

    setSchoolData({
      subjects: mockSubjects,
      assignments: mockAssignments,
      exams: mockExams,
      notes: mockNotes,
    });
  };

  const addNewHabit = () => {
    if (!newHabitName.trim()) return;

    const newHabit: Habit = {
      id: Math.max(...habits.map((h) => h.id), 0) + 1,
      name: newHabitName,
      description: "",
      category: "כללי",
      days: {},
    };

    setHabits((prev) => [...prev, newHabit]);
    setNewHabitName("");
  };

  const deleteHabit = (id: number) => {
    const remaining = habits.filter((h) => h.id !== id);
    setHabits(remaining);

    if (selectedHabitId === id) {
      setSelectedHabitId(remaining.length > 0 ? remaining[0].id : null);
      setSelectedHabitDayKey(null);
    }
  };

  const startEdit = (id: number, currentName: string) => {
    setEditingHabitId(id);
    setEditName(currentName);
  };

  const saveEdit = () => {
    if (!editName.trim()) return;

    setHabits((prev) =>
      prev.map((h) => (h.id === editingHabitId ? { ...h, name: editName } : h))
    );
    setEditingHabitId(null);
    setEditName("");
  };

  const cancelEdit = () => {
    setEditingHabitId(null);
    setEditName("");
  };

  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const addCourse = () => {
    if (!newCourseName.trim()) return;

    const newCourse: Course = {
      id: Math.max(...courses.map((c) => c.id), 0) + 1,
      name: newCourseName,
      color: newCourseColor,
      units: [],
      xp: 0,
      importantDates: [],
    };

    setCourses((prev) => [...prev, newCourse]);
    setNewCourseName("");
  };

  const deleteCourse = (id: number) => {
    setCourses((prev) => prev.filter((c) => c.id !== id));
  };

  const startEditCourse = (id: number, currentName: string) => {
    setEditingCourseId(id);
    setEditingCourseName(currentName);
  };

  const saveEditCourse = () => {
    if (!editingCourseName.trim()) return;
    setCourses((prev) =>
      prev.map((c) =>
        c.id === editingCourseId ? { ...c, name: editingCourseName } : c
      )
    );
    setEditingCourseId(null);
    setEditingCourseName("");
  };

  const cancelEditCourse = () => {
    setEditingCourseId(null);
    setEditingCourseName("");
  };

  const toggleUnit = (unitId: string) => {
    setSelectedUnitId(selectedUnitId === unitId ? null : unitId);
  };

  const toggleTask = (unitId: string, taskId: string) => {
    if (!selectedCourseId) return;
    setCourses((prev) =>
      prev.map((c) =>
        c.id === selectedCourseId
          ? {
              ...c,
              units: normalizeUnitsState(
                c.units.map((u) => {
                  if (u.id !== unitId) return u;
                  const updatedTasks = u.tasks.map((t) =>
                    t.id === taskId ? { ...t, completed: !t.completed } : t
                  );
                  return { ...u, tasks: updatedTasks };
                })
              ),
            }
          : c
      )
    );
  };

  const addTaskToUnit = (unitId: string) => {
    if (!newTaskTitle.trim() || !selectedCourseId) return;
    setCourses((prev) =>
      prev.map((c) =>
        c.id === selectedCourseId
          ? {
              ...c,
              units: normalizeUnitsState(
                c.units.map((u) =>
                  u.id === unitId
                    ? {
                        ...u,
                        tasks: [
                          ...u.tasks,
                          {
                            id: `task-${unitId}-${Date.now()}`,
                            title: newTaskTitle.trim(),
                            type: newTaskType,
                            completed: false,
                          },
                        ],
                      }
                    : u
                )
              ),
            }
          : c
      )
    );
    setNewTaskTitle("");
    setNewTaskType("general");
    setAddingTaskToUnit(null);
  };

  const deleteTask = (unitId: string, taskId: string) => {
    if (!selectedCourseId) return;
    setCourses((prev) =>
      prev.map((c) =>
        c.id === selectedCourseId
          ? {
              ...c,
              units: normalizeUnitsState(
                c.units.map((u) => {
                  if (u.id !== unitId) return u;
                  const updatedTasks = u.tasks.filter((t) => t.id !== taskId);
                  return { ...u, tasks: updatedTasks };
                })
              ),
            }
          : c
      )
    );
  };

  const startEditUnit = (unitId: string, currentTitle: string) => {
    setEditingUnitId(unitId);
    setEditingUnitTitle(currentTitle);
  };

  const saveEditUnit = () => {
    if (!editingUnitTitle.trim() || !selectedCourseId) return;
    setCourses((prev) =>
      prev.map((c) =>
        c.id === selectedCourseId
          ? {
              ...c,
              units: c.units.map((u) =>
                u.id === editingUnitId ? { ...u, title: editingUnitTitle } : u
              ),
            }
          : c
      )
    );
    setEditingUnitId(null);
    setEditingUnitTitle("");
  };

  const cancelEditUnit = () => {
    setEditingUnitId(null);
    setEditingUnitTitle("");
  };

  const startEditTask = (unitId: string, taskId: string, currentTitle: string, currentType: string) => {
    setEditingTaskId(taskId);
    setEditingTaskTitle(currentTitle);
    setEditingTaskType(coerceTaskType(currentType));
  };

  const saveEditTask = () => {
    if (!editingTaskTitle.trim() || !selectedCourseId || !editingTaskId) return;
    setCourses((prev) =>
      prev.map((c) =>
        c.id === selectedCourseId
          ? {
              ...c,
              units: c.units.map((u) =>
                u.tasks.some((t) => t.id === editingTaskId)
                  ? {
                      ...u,
                      tasks: u.tasks.map((t) =>
                        t.id === editingTaskId
                          ? { ...t, title: editingTaskTitle, type: coerceTaskType(editingTaskType) }
                          : t
                      ),
                    }
                  : u
              ),
            }
          : c
      )
    );
    setEditingTaskId(null);
    setEditingTaskTitle("");
    setEditingTaskType("general");
  };

  const cancelEditTask = () => {
    setEditingTaskId(null);
    setEditingTaskTitle("");
    setEditingTaskType("general");
    cancelTaskDrag();
  };

  const cancelTaskDrag = () => {
    setDraggingTaskId(null);
    setDraggingFromUnitId(null);
    setIsActiveDrag(false);
    setHoveredTargetTaskId(null);
    dragStartRef.current = null;
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  const startLongPress = (unitId: string, taskId: string, e: React.MouseEvent | React.TouchEvent) => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
    
    const clientX = "touches" in e ? e.touches[0]?.clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0]?.clientY : (e as React.MouseEvent).clientY;
    
    dragStartRef.current = { x: clientX, y: clientY };
    
    longPressRef.current = setTimeout(() => {
      setDraggingTaskId(taskId);
      setDraggingFromUnitId(unitId);
      setIsActiveDrag(true);
    }, 2000);
  };

  const endLongPress = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  const handleTaskMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isActiveDrag || !draggingTaskId || !draggingFromUnitId) return;
    e.preventDefault();
  };

  const handleTaskDrop = (targetUnitId: string, targetTaskId: string) => {
    if (!isActiveDrag || !draggingTaskId || !draggingFromUnitId) {
      cancelTaskDrag();
      return;
    }

    if (draggingFromUnitId === targetUnitId && draggingTaskId === targetTaskId) {
      cancelTaskDrag();
      return;
    }

    if (!selectedCourseId) {
      cancelTaskDrag();
      return;
    }

    setCourses((prev) =>
      prev.map((c) => {
        if (c.id !== selectedCourseId) return c;

        const newUnits = c.units.map((u) => {
          // Remove task from source unit
          if (u.id === draggingFromUnitId) {
            return {
              ...u,
              tasks: u.tasks.filter((t) => t.id !== draggingTaskId),
            };
          }
          return u;
        });

        // Add task to target unit at correct position
        const updatedUnits = newUnits.map((u) => {
          if (u.id !== targetUnitId) return u;

          const sourceTask = c.units
            .find((x) => x.id === draggingFromUnitId)
            ?.tasks.find((t) => t.id === draggingTaskId);

          if (!sourceTask) return u;

          const targetIndex = u.tasks.findIndex((t) => t.id === targetTaskId);
          const newTasks = [...u.tasks];

          if (targetIndex === -1) {
            newTasks.push(sourceTask);
          } else {
            newTasks.splice(targetIndex, 0, sourceTask);
          }

          return { ...u, tasks: newTasks };
        });

        return {
          ...c,
          units: normalizeUnitsState(updatedUnits),
        };
      })
    );
    cancelTaskDrag();
  };

  const deleteUnit = (unitId: string) => {
    if (!selectedCourseId) return;
    setCourses((prev) =>
      prev.map((c) =>
        c.id === selectedCourseId
          ? {
              ...c,
              units: normalizeUnitsState(c.units.filter((u) => u.id !== unitId)),
            }
          : c
      )
    );
    if (selectedUnitId === unitId) {
      setSelectedUnitId(null);
    }
  };

  const toggleUnitCompletion = (unitId: string) => {
    if (!selectedCourseId) return;
    setCourses((prev) =>
      prev.map((c) =>
        c.id === selectedCourseId
          ? {
              ...c,
              units: normalizeUnitsState(
                c.units.map((u) => {
                  if (u.id !== unitId) return u;
                  const newCompleted = !u.completed;
                  return {
                    ...u,
                    completed: newCompleted,
                    progress: newCompleted ? 100 : calculateUnitProgress(u),
                  };
                })
              ),
            }
          : c
      )
    );
  };

  const addImportantDate = () => {
    if (!newDateTitle.trim() || !newDateValue || !selectedCourseId) return;
    setCourses((prev) =>
      prev.map((c) =>
        c.id === selectedCourseId
          ? {
              ...c,
              importantDates: [
                ...c.importantDates,
                {
                  id: Math.max(...c.importantDates.map((d) => d.id), 0) + 1,
                  title: newDateTitle,
                  date: newDateValue,
                  type: newDateType,
                },
              ],
            }
          : c
      )
    );
    setNewDateTitle("");
    setNewDateValue("");
  };

  const deleteImportantDate = (dateId: number) => {
    if (!selectedCourseId) return;
    setCourses((prev) =>
      prev.map((c) =>
        c.id === selectedCourseId
          ? { ...c, importantDates: c.importantDates.filter((d) => d.id !== dateId) }
          : c
      )
    );
  };

  const selectedHabit = habits.find((h) => h.id === selectedHabitId) || habits[0];



  const gymMonthDays = useMemo(
  () => getMonthDays(gymCurrentYear, gymCurrentMonth),
  [gymCurrentYear, gymCurrentMonth]
);

const selectedGymMuscle =
  gymData.muscles.find((m) => m.id === selectedGymMuscleId) || null;

const toggleGymDayStatus = (muscleId: string, dateKey: string, isFuture: boolean) => {
  if (isFuture) return;

  setGymData((prev) => ({
    muscles: prev.muscles.map((m) => {
      if (m.id !== muscleId) return m;

      const current = m.days[dateKey] || "none";
      const next =
        current === "none" ? "done" : current === "done" ? "missed" : "none";

      return {
        ...m,
        days: {
          ...m.days,
          [dateKey]: next,
        },
      };
    }),
  }));
};

const addGymNote = () => {
  if (!selectedGymMuscleId || !gymNoteText.trim()) return;

  const todayKey = dateKeyFromDate(new Date());

  setGymData((prev) => ({
    muscles: prev.muscles.map((m) =>
      m.id === selectedGymMuscleId
        ? {
            ...m,
            notes: [
              {
                id: `gn-${Date.now()}`,
                date: todayKey,
                text: gymNoteText.trim(),
              },
              ...m.notes,
            ],
          }
        : m
    ),
  }));

  setGymNoteText("");
};

const completeGymWorkoutToday = () => {
  if (!selectedGymMuscleId) return;
  const todayKey = dateKeyFromDate(new Date());
  toggleGymDayStatus(selectedGymMuscleId, todayKey, false);
};

const totalGymWorkouts = gymData.muscles.reduce(
  (sum, muscle) =>
    sum + Object.values(muscle.days).filter((v) => v === "done").length,
  0
);

const overallGymStreak = Math.max(
  ...gymData.muscles.map((m) => calculateGymStreak(m.days)),
  0
);

const mostActiveGymMuscle = getMostActiveGymMuscle(gymData.muscles);

const totalWeeklyCompleted = gymData.muscles.reduce(
  (sum, muscle) => sum + getGymWeeklyStats(muscle).completed,
  0
);

const totalWeeklyTarget = gymData.muscles.reduce(
  (sum, muscle) => sum + muscle.targetPerWeek,
  0
);

const overallWeeklyPercent =
  totalWeeklyTarget > 0
    ? Math.min(100, Math.round((totalWeeklyCompleted / totalWeeklyTarget) * 100))
    : 0; 
  const toggleDayStatus = (dateKey: string, isFuture: boolean) => {
    if (isFuture || !selectedHabitId) return;
    setSelectedHabitDayKey(dateKey);
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== selectedHabitId) return h;
        const current = h.days[dateKey] || "none";
        const next =
          current === "none" ? "done" : current === "done" ? "missed" : "none";
        return { ...h, days: { ...h.days, [dateKey]: next } };
      })
    );
  };

  const setHabitNote = (dateKey: string, note: string) => {
    if (!selectedHabitId) return;
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== selectedHabitId) return h;
        return { ...h, notes: { ...(h.notes ?? {}), [dateKey]: note } };
      })
    );
  };

  const studyTimerCourse = studyTimerOpen
    ? courses.find((c) => c.id === studyTimerOpen.courseId)
    : null;

  return (
    <div
      className="min-h-screen bg-[#050505] text-zinc-100 font-sans selection:bg-blue-500/30"
      dir="rtl"
    >
      {studyTimerOpen && studyTimerCourse && (
        <UniversityStudyTimerFullPage
          date={studyTimerOpen.date}
          courseName={studyTimerCourse.name}
          accentColor={studyTimerCourse.color}
          onClose={() => setStudyTimerOpen(null)}
          onSave={(seconds) => {
            setUniversityStudy((prev) => ({
              entries: [
                ...prev.entries,
                {
                  id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  courseId: studyTimerOpen.courseId,
                  date: studyTimerOpen.date,
                  seconds,
                },
              ],
            }));
            setStudyTimerOpen(null);
          }}
        />
      )}
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 bg-zinc-950 border-l border-zinc-800/50 p-8 flex flex-col gap-8">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-emerald-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Target className="text-black" size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter">CORE OS</h1>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                Life Management
              </p>
            </div>
          </div>

          <nav className="space-y-1">
            <NavItem
              icon={<CheckCircle2 size={18} />}
              label="הרגלים"
              active={activePage === "habits"}
              onClick={() => setActivePage("habits")}
            />
            <NavItem
              icon={<Dumbbell size={18} />}
              label="חדר כושר"
              active={activePage === "gym"}
              onClick={() => setActivePage("gym")}
            />
            <NavItem
              icon={<GraduationCap size={18} />}
              label="אוניברסיטה"
              active={activePage === "university"}
              onClick={() => setActivePage("university")}
            />
            <NavItem
              icon={<School size={18} />}
              label="בית ספר"
              active={activePage === "school"}
              onClick={() => setActivePage("school")}
            />
            <Link
              href="/time-planning"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 text-zinc-500 hover:text-white hover:bg-zinc-900"
            >
              <CalendarDays size={18} />
              <span className="text-sm font-bold">תכנון זמן</span>
            </Link>
            <Link
              href="/goals"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 text-zinc-500 hover:text-white hover:bg-zinc-900"
            >
              <Target size={18} />
              <span className="text-sm font-bold">המטרות שלי</span>
            </Link>
          </nav>

          <div className="mt-auto pt-8 border-t border-zinc-800/50 space-y-4">
            <QuickStat
              label="רצף מוביל"
              value={`${Math.max(...habits.map((h) => calculateStreak(h.days)), 0)} ימים`}
              icon={<Flame size={14} className="text-orange-500" />}
            />
            <QuickStat
              label="ניסיון (XP)"
              value="Level 12"
              icon={<Trophy size={14} className="text-yellow-500" />}
            />
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-zinc-900/20 via-transparent to-transparent">
          <div className="max-w-6xl mx-auto p-12">
            {activePage === "habits" && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <header className="mb-12 flex justify-between items-end">
                  <div>
                    <h2 className="text-4xl font-black tracking-tight text-white mb-2">
                      מרכז ההרגלים
                    </h2>
                    <p className="text-zinc-400 text-lg">
                      "אנחנו מה שאנחנו עושים שוב ושוב."
                    </p>
                  </div>

                  <div className="bg-zinc-900/50 border border-zinc-800 p-2 rounded-2xl flex gap-2">
                    <input
                      type="text"
                      placeholder="הרגל חדש..."
                      className="bg-transparent border-none outline-none px-4 text-sm w-48"
                      value={newHabitName}
                      onChange={(e) => setNewHabitName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addNewHabit()}
                    />
                    <button
                      className="bg-white text-black p-2 rounded-xl hover:bg-zinc-200 transition-colors"
                      onClick={addNewHabit}
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </header>

                <div className="grid grid-cols-12 gap-8">
                  {/* Habits List */}
                  <div className="col-span-4 space-y-3">
                    {habits.map((h) => (
                      <div key={h.id} className="relative group">
                        <button
                          onClick={() => { setSelectedHabitId(h.id); setSelectedHabitDayKey(null); }}
                          className={`w-full p-5 rounded-3xl border transition-all text-right ${
                            selectedHabitId === h.id
                              ? "bg-zinc-100 border-white text-zinc-950 shadow-2xl shadow-white/10 scale-[1.02]"
                              : "bg-zinc-900/40 border-zinc-800/50 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900/60"
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-widest ${
                                selectedHabitId === h.id ? "text-zinc-500" : "text-zinc-600"
                              }`}
                            >
                              {h.category}
                            </span>
                            <span className="text-xs font-bold">
                              {calculateStreak(h.days)}d streak
                            </span>
                          </div>

                          {editingHabitId === h.id ? (
                            <div className="flex gap-2 items-center">
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm flex-1 text-white"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEdit();
                                  if (e.key === "Escape") cancelEdit();
                                }}
                                autoFocus
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  saveEdit();
                                }}
                                className="text-green-500 hover:text-green-400"
                                type="button"
                              >
                                ✓
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelEdit();
                                }}
                                className="text-red-500 hover:text-red-400"
                                type="button"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <h4 className="text-lg font-bold">{h.name}</h4>
                          )}
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(h.id, h.name);
                          }}
                          className="absolute top-2 right-10 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-500 hover:bg-blue-600 text-white p-1 rounded-full"
                          type="button"
                        >
                          <Pencil size={14} />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteHabit(h.id);
                          }}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white p-1 rounded-full"
                          type="button"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Calendar View */}
                  <div className="col-span-8">
                    <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-[40px] p-10 backdrop-blur-xl">
                      <div className="flex justify-between items-center mb-10">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center">
                            <CalendarIcon size={24} className="text-blue-400" />
                          </div>
                          <div>
                            <h3 className="text-2xl font-bold text-white">
                              {selectedHabit?.name ?? "אין הרגל נבחר"}
                            </h3>
                            <p className="text-sm text-zinc-500">
                              {new Date(currentYear, currentMonth).toLocaleDateString("he-IL", {
                                month: "long",
                                year: "numeric",
                              })}
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={goToPrevMonth}
                            className="p-2 rounded-xl border border-zinc-800 hover:bg-zinc-800 transition-colors"
                            type="button"
                          >
                            <ChevronRight size={20} />
                          </button>
                          <button
                            onClick={goToNextMonth}
                            className="p-2 rounded-xl border border-zinc-800 hover:bg-zinc-800 transition-colors"
                            type="button"
                          >
                            <ChevronLeft size={20} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-7 gap-3" dir="ltr">
                        {["S", "M", "T", "W", "T", "F", "S"].map((d, index) => (
                          <div
                            key={`${d}-${index}`}
                            className="text-center text-[10px] font-black text-zinc-600 mb-2 tracking-widest"
                          >
                            {d}
                          </div>
                        ))}

                        {monthDays.map((day, idx) => {
                          if (!day) return <div key={`empty-${idx}`} />;

                          const status = selectedHabit?.days[day.key] || "none";

                          return (
                            <button
                              key={day.key}
                              onClick={() => toggleDayStatus(day.key, day.isFuture)}
                              disabled={day.isFuture || !selectedHabit}
                              type="button"
                              className={`aspect-square rounded-2xl border flex flex-col items-center justify-center text-sm font-bold transition-all relative group
                                ${
                                  day.isFuture
                                    ? "bg-transparent border-zinc-900 text-zinc-800 cursor-not-allowed"
                                    : status === "done"
                                    ? "bg-emerald-500 border-emerald-400 text-emerald-950 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                                    : status === "missed"
                                    ? "bg-red-500/10 border-red-500/50 text-red-500"
                                    : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:bg-zinc-800"
                                }
                                ${day.isToday ? "ring-2 ring-blue-500 ring-offset-4 ring-offset-[#0c0c0c]" : ""}
                                ${selectedHabitDayKey === day.key ? "ring-2 ring-white/40 ring-offset-2 ring-offset-[#0c0c0c]" : ""}
                              `}
                            >
                              {day.dayNumber}
                              {!day.isFuture && selectedHabit?.notes?.[day.key] && (
                                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-white/60" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Day note panel */}
                      {selectedHabitDayKey && selectedHabit && (
                        <div className="mt-5 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
                          <div className="flex items-center justify-between mb-2.5" dir="rtl">
                            <div className="flex items-center gap-2 text-xs font-bold text-zinc-400">
                              <span>
                                {new Date(selectedHabitDayKey + "T00:00:00").toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" })}
                              </span>
                              {selectedHabit.days[selectedHabitDayKey] === "done" && (
                                <span className="text-emerald-400">· בוצע ✓</span>
                              )}
                              {selectedHabit.days[selectedHabitDayKey] === "missed" && (
                                <span className="text-red-400">· פוספס ✗</span>
                              )}
                            </div>
                            <button
                              onClick={() => setSelectedHabitDayKey(null)}
                              className="text-zinc-600 hover:text-zinc-300 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          <textarea
                            value={selectedHabit.notes?.[selectedHabitDayKey] ?? ""}
                            onChange={(e) => setHabitNote(selectedHabitDayKey, e.target.value)}
                            placeholder="מה הסיבה? למה ירוק / אדום? כתוב כאן..."
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 resize-none transition-colors"
                            rows={2}
                            dir="rtl"
                          />
                        </div>
                      )}

                      <div className="mt-10 flex gap-8 border-t border-zinc-800/50 pt-8">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-emerald-500" />
                          <span className="text-xs text-zinc-400 font-medium">בוצע</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500/50" />
                          <span className="text-xs text-zinc-400 font-medium">פוספס</span>
                        </div>
                        <div className="flex items-center gap-2 text-blue-400">
                          <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                          <span className="text-xs font-bold uppercase tracking-tighter">
                            היום
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}


            {activePage === "gym" && !selectedGymMuscle && (
  <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
    <header className="mb-12">
      <h2 className="text-4xl font-black tracking-tight text-white mb-2">
        חדר כושר
      </h2>
      <p className="text-zinc-400 text-lg">
        "No excuses. Just results."
      </p>
    </header>

    <div className="grid grid-cols-12 gap-6 mb-10">
      <div className="col-span-12 md:col-span-3 bg-zinc-900/50 border border-zinc-800 rounded-3xl p-5">
        <div className="flex items-center gap-2 text-zinc-400 mb-2">
          <Flame size={16} className="text-orange-400" />
          <span className="text-sm font-bold">רצף מוביל</span>
        </div>
        <div className="text-3xl font-black text-white">{overallGymStreak}</div>
      </div>

      <div className="col-span-12 md:col-span-3 bg-zinc-900/50 border border-zinc-800 rounded-3xl p-5">
        <div className="flex items-center gap-2 text-zinc-400 mb-2">
          <Dumbbell size={16} className="text-blue-400" />
          <span className="text-sm font-bold">סה״כ אימונים</span>
        </div>
        <div className="text-3xl font-black text-white">{totalGymWorkouts}</div>
      </div>

      <div className="col-span-12 md:col-span-3 bg-zinc-900/50 border border-zinc-800 rounded-3xl p-5">
        <div className="flex items-center gap-2 text-zinc-400 mb-2">
          <Trophy size={16} className="text-yellow-400" />
          <span className="text-sm font-bold">הכי פעיל</span>
        </div>
        <div className="text-2xl font-black text-white">
          {mostActiveGymMuscle?.name ?? "—"}
        </div>
      </div>

      <div className="col-span-12 md:col-span-3 bg-zinc-900/50 border border-zinc-800 rounded-3xl p-5">
        <div className="flex items-center gap-2 text-zinc-400 mb-2">
          <Target size={16} className="text-emerald-400" />
          <span className="text-sm font-bold">עמידה ביעד שבועי</span>
        </div>
        <div className="text-3xl font-black text-white">{overallWeeklyPercent}%</div>
      </div>
    </div>

    <div className="grid grid-cols-12 gap-6">
      {gymData.muscles.map((muscle) => {
        const streak = calculateGymStreak(muscle.days);
        const totalDone = Object.values(muscle.days).filter((v) => v === "done").length;
        const weekly = getGymWeeklyStats(muscle);

        return (
          <button
            key={muscle.id}
            onClick={() => setSelectedGymMuscleId(muscle.id)}
            className="col-span-12 md:col-span-6 xl:col-span-4 rounded-[28px] border border-zinc-800 bg-zinc-900/50 p-6 text-right transition-all hover:scale-[1.02] hover:border-zinc-700 hover:bg-zinc-900"
            type="button"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-black text-white">{muscle.name}</h3>
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: muscle.color }}
              />
            </div>

            <div className="flex items-center justify-between text-sm text-zinc-400 mb-2">
              <span>רצף</span>
              <span className="font-bold text-white">{streak} ימים</span>
            </div>

            <div className="flex items-center justify-between text-sm text-zinc-400 mb-2">
              <span>סה״כ אימונים</span>
              <span className="font-bold text-white">{totalDone}</span>
            </div>

            <div className="flex items-center justify-between text-sm text-zinc-400 mb-3">
              <span>השבוע</span>
              <span className="font-bold text-white">
                {weekly.completed}/{weekly.target}
              </span>
            </div>

            <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden mb-3">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${weekly.percent}%`,
                  backgroundColor: muscle.color,
                }}
              />
            </div>

            <p className="text-xs text-zinc-500">עמידה ביעד השבועי: {weekly.percent}%</p>
          </button>
        );
      })}
    </div>
  </div>
)}

{activePage === "gym" && selectedGymMuscle && (
  <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
    <header className="mb-10 flex justify-between items-start">
      <div>
        <button
          onClick={() => setSelectedGymMuscleId(null)}
          className="text-blue-400 hover:text-blue-300 mb-4 flex items-center gap-2 text-sm"
          type="button"
        >
          ← חזור לחדר כושר
        </button>
        <h2 className="text-4xl font-black tracking-tight text-white mb-2">
          {selectedGymMuscle.name}
        </h2>
        <p className="text-zinc-400 text-lg">Discipline beats motivation.</p>
      </div>

      <button
        onClick={completeGymWorkoutToday}
        className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 px-5 py-3 rounded-2xl font-black transition-all"
        type="button"
      >
        השלמתי אימון
      </button>
    </header>

    <div className="grid grid-cols-12 gap-6 mb-8">
      <div className="col-span-12 md:col-span-3 bg-zinc-900/50 border border-zinc-800 rounded-3xl p-5">
        <p className="text-sm text-zinc-400 mb-2">רצף</p>
        <div className="text-3xl font-black text-white">
          {calculateGymStreak(selectedGymMuscle.days)}
        </div>
      </div>

      <div className="col-span-12 md:col-span-3 bg-zinc-900/50 border border-zinc-800 rounded-3xl p-5">
        <p className="text-sm text-zinc-400 mb-2">אימונים החודש</p>
        <div className="text-3xl font-black text-white">
          {getGymMonthlyStats(selectedGymMuscle, gymCurrentYear, gymCurrentMonth).doneCount}
        </div>
      </div>

      <div className="col-span-12 md:col-span-3 bg-zinc-900/50 border border-zinc-800 rounded-3xl p-5">
        <p className="text-sm text-zinc-400 mb-2">7 ימים אחרונים</p>
        <div className="text-3xl font-black text-white">
          {getGymWeeklyStats(selectedGymMuscle).completed}
        </div>
      </div>

      <div className="col-span-12 md:col-span-3 bg-zinc-900/50 border border-zinc-800 rounded-3xl p-5">
        <p className="text-sm text-zinc-400 mb-2">רמת פעילות</p>
        <div className="text-3xl font-black text-white">
          {getGymWeeklyStats(selectedGymMuscle).percent}%
        </div>
      </div>
    </div>

    <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden mb-10">
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${getGymWeeklyStats(selectedGymMuscle).percent}%`,
          backgroundColor: selectedGymMuscle.color,
        }}
      />
    </div>

    <div className="grid grid-cols-12 gap-8">
      <div className="col-span-12 xl:col-span-8">
        <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-[40px] p-10 backdrop-blur-xl">
          <div className="flex justify-between items-center mb-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center">
                <CalendarIcon size={24} className="text-blue-400" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">
                  לוח אימונים
                </h3>
                <p className="text-sm text-zinc-500">
                  {new Date(gymCurrentYear, gymCurrentMonth).toLocaleDateString("he-IL", {
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (gymCurrentMonth === 0) {
                    setGymCurrentMonth(11);
                    setGymCurrentYear((prev) => prev - 1);
                  } else {
                    setGymCurrentMonth((prev) => prev - 1);
                  }
                }}
                className="p-2 rounded-xl border border-zinc-800 hover:bg-zinc-800 transition-colors"
                type="button"
              >
                <ChevronRight size={20} />
              </button>

              <button
                onClick={() => {
                  if (gymCurrentMonth === 11) {
                    setGymCurrentMonth(0);
                    setGymCurrentYear((prev) => prev + 1);
                  } else {
                    setGymCurrentMonth((prev) => prev + 1);
                  }
                }}
                className="p-2 rounded-xl border border-zinc-800 hover:bg-zinc-800 transition-colors"
                type="button"
              >
                <ChevronLeft size={20} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-3" dir="ltr">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, index) => (
              <div
                key={`${d}-${index}`}
                className="text-center text-[10px] font-black text-zinc-600 mb-2 tracking-widest"
              >
                {d}
              </div>
            ))}

            {gymMonthDays.map((day, idx) => {
              if (!day) return <div key={`empty-gym-${idx}`} />;

              const status = selectedGymMuscle.days[day.key] || "none";

              return (
                <button
                  key={day.key}
                  onClick={() =>
                    toggleGymDayStatus(selectedGymMuscle.id, day.key, day.isFuture)
                  }
                  disabled={day.isFuture}
                  type="button"
                  className={`aspect-square rounded-2xl border flex items-center justify-center text-sm font-bold transition-all relative
                    ${
                      day.isFuture
                        ? "bg-transparent border-zinc-900 text-zinc-800 cursor-not-allowed"
                        : status === "done"
                        ? "bg-emerald-500 border-emerald-400 text-emerald-950 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                        : status === "missed"
                        ? "bg-red-500/10 border-red-500/50 text-red-500"
                        : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:bg-zinc-800"
                    }
                    ${day.isToday ? "ring-2 ring-blue-500 ring-offset-4 ring-offset-[#0c0c0c]" : ""}
                  `}
                >
                  {day.dayNumber}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="col-span-12 xl:col-span-4 space-y-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
          <h4 className="text-xl font-bold text-white mb-4">הערות אימון</h4>

          <textarea
            placeholder="מה עשית באימון היום?"
            className="w-full min-h-[120px] bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-blue-500"
            value={gymNoteText}
            onChange={(e) => setGymNoteText(e.target.value)}
          />

          <button
            onClick={addGymNote}
            className="mt-3 w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-2xl font-bold transition-colors"
            type="button"
          >
            הוסף הערה
          </button>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
          <h4 className="text-xl font-bold text-white mb-4">אימונים אחרונים</h4>

          <div className="space-y-3 max-h-[320px] overflow-y-auto">
            {selectedGymMuscle.notes.length === 0 ? (
              <p className="text-zinc-500 text-sm">אין עדיין הערות אימון.</p>
            ) : (
              selectedGymMuscle.notes
                .slice()
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((note) => (
                  <div
                    key={note.id}
                    className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4"
                  >
                    <div className="text-xs text-zinc-500 mb-2">{note.date}</div>
                    <div className="text-sm text-white whitespace-pre-wrap">
                      {note.text}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
)}




            {activePage === "university" && selectedCourseId && courses.find((c) => c.id === selectedCourseId) && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                {(() => {
                  const foundCourse = courses.find((c) => c.id === selectedCourseId);
                  const course = foundCourse ? normalizeCourse(foundCourse) : null;
                  if (!course) return null;
                  return (
                    <div>
                      <header className="mb-8 flex justify-between items-start">
                        <div>
                          <button
                            onClick={() => setSelectedCourseId(null)}
                            className="text-blue-400 hover:text-blue-300 mb-4 flex items-center gap-2 text-sm"
                          >
                            ← חזור לקורסים
                          </button>
                          <h2 className="text-4xl font-black tracking-tight text-white">{course.name}</h2>
                        </div>
                      </header>

                      {/* Course Tabs */}
                      <div className="mb-8 flex gap-2">
                        <button
                          onClick={() => setCourseTab("learning")}
                          className={`px-6 py-3 rounded-xl font-bold transition-all ${
                            courseTab === "learning"
                              ? "bg-orange-500 text-white shadow-[0_0_20px_rgba(251,146,60,0.4)]"
                              : "bg-zinc-900/50 text-zinc-400 hover:text-white hover:bg-zinc-800"
                          }`}
                        >
                          מסלול למידה
                        </button>
                        <button
                          onClick={() => setCourseTab("dates")}
                          className={`px-6 py-3 rounded-xl font-bold transition-all ${
                            courseTab === "dates"
                              ? "bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.4)]"
                              : "bg-zinc-900/50 text-zinc-400 hover:text-white hover:bg-zinc-800"
                          }`}
                        >
                          תאריכים חשובים
                        </button>
                        <button
                          onClick={() => setCourseTab("study-time")}
                          className={`px-6 py-3 rounded-xl font-bold transition-all ${
                            courseTab === "study-time"
                              ? "bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)]"
                              : "bg-zinc-900/50 text-zinc-400 hover:text-white hover:bg-zinc-800"
                          }`}
                        >
                          זמן לימוד
                        </button>
                      </div>

                      <div className="mb-8 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl px-4 py-2">
                            <span className="text-zinc-400 text-sm">XP: </span>
                            <span className="text-yellow-400 font-bold">{calculateTotalXP(course.units)}</span>
                          </div>
                          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl px-4 py-2">
                            <span className="text-zinc-400 text-sm">התקדמות: </span>
                            <span className="text-blue-400 font-bold">
                              {course.units.length > 0 ? Math.round((course.units.filter(u => isUnitCompleted(u)).length / course.units.length) * 100) : 0}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {courseTab === "learning" && (
                        <div className="grid grid-cols-12 gap-8">
                          {/* Units Section */}
                          <div className="col-span-12">
                            <div className="relative overflow-hidden rounded-[28px] border border-orange-500/20 bg-gradient-to-br from-zinc-950 via-black to-zinc-950 p-6 shadow-[0_0_60px_rgba(251,146,60,0.08)] md:p-8">
                              <div
                                className="pointer-events-none absolute -start-24 -top-24 h-56 w-56 rounded-full bg-orange-500/10 blur-3xl"
                                aria-hidden
                              />
                              <div
                                className="pointer-events-none absolute -end-16 bottom-0 h-44 w-44 rounded-full bg-amber-500/10 blur-3xl"
                                aria-hidden
                              />
                              <div className="relative">
                                <h3 className="mb-1 flex flex-wrap items-center gap-2 text-2xl font-black text-transparent bg-clip-text bg-gradient-to-l from-amber-200 via-orange-300 to-rose-300 md:text-3xl">
                                  <Sparkles className="text-amber-400 shrink-0" size={28} />
                                  מסלול הלמידה
                                </h3>
                                <p className="mb-8 text-sm leading-relaxed text-zinc-500">
                                  יחידות נפתחות לפי הסדר. השלם את כל המשימות (או סמן יחידה כהושלמה) כדי
                                  לשחרר את הבאה בתור.
                                </p>
                                <div className="space-y-8 md:ps-3">
                                {course.units.map((unit, index) => {
                                  const progress = unit.completed ? 100 : calculateUnitProgress(unit);
                                  const isCompleted = unit.completed;
                                  const isUnlocked = unit.unlocked;
                                  const isSelected = selectedUnitId === unit.id;
                                  const firstOpenIndex = course.units.findIndex(
                                    (u) => u.unlocked && !u.completed
                                  );
                                  const isCurrentUnit =
                                    !isCompleted &&
                                    isUnlocked &&
                                    (isSelected ||
                                      (!selectedUnitId && index === firstOpenIndex));
                                  const isFutureUnit =
                                    isUnlocked && !isCompleted && !isCurrentUnit;
                                  
                                  // Calculate task completion info
                                  const completedTasks = unit.tasks.filter(t => t.completed).length;
                                  const totalTasks = unit.tasks.length;
                                  const taskProgressText = totalTasks > 0 ? `${completedTasks}/${totalTasks} משימות` : "אין משימות";
                                  
                                  // XP reward for this unit (bonus XP for completing unit + task XP)
                                  const unitXP = unit.tasks.length * 10 + (unit.completed ? 50 : 0);

                                  return (
                                    <div
                                      key={unit.id}
                                      className={`relative learning-unit-in ${isCurrentUnit ? "z-[1]" : ""}`}
                                      style={{ animationDelay: `${index * 65}ms` }}
                                    >
                                      {index < course.units.length - 1 && (
                                        <div
                                          className={`absolute top-[3.25rem] bottom-[-1.5rem] w-px start-5 md:start-6 bg-gradient-to-b pointer-events-none ${
                                            isCompleted
                                              ? "from-emerald-500/50 to-orange-500/20"
                                              : "from-zinc-600 to-zinc-800"
                                          }`}
                                          aria-hidden
                                        />
                                      )}
                                      <div
                                        onClick={() =>
                                          (isUnlocked || isCompleted) &&
                                          editingUnitId !== unit.id &&
                                          toggleUnit(unit.id)
                                        }
                                        className={`relative rounded-2xl cursor-pointer transition-all duration-500 group motion-safe:hover:scale-[1.01] ${
                                          isCompleted
                                            ? "bg-gradient-to-br from-emerald-700/90 via-emerald-800 to-emerald-950 p-4 border border-emerald-500/40 shadow-[0_12px_40px_rgba(16,185,129,0.2)]"
                                            : isCurrentUnit
                                            ? "learning-node-pulse bg-gradient-to-br from-amber-200 via-orange-400 to-rose-600 p-5 md:p-6 border-2 border-amber-200/90 shadow-[0_0_50px_rgba(251,146,60,0.45)]"
                                            : isFutureUnit
                                            ? "bg-gradient-to-br from-amber-500/25 via-orange-600/20 to-zinc-900 p-4 border border-orange-500/30 hover:border-orange-400/50 shadow-[0_8px_32px_rgba(251,146,60,0.15)]"
                                            : "bg-gradient-to-br from-zinc-800 via-zinc-900 to-black p-4 border border-zinc-700/90 opacity-95 cursor-not-allowed"
                                        }`}
                                      >
                                        <div className="flex justify-between items-center gap-3">
                                          <div className="flex items-center gap-3 min-w-0">
                                            <div
                                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 ${
                                                isCompleted
                                                  ? "border-emerald-300/50 bg-emerald-950/40"
                                                  : !isUnlocked
                                                  ? "border-zinc-600 bg-zinc-950"
                                                  : isCurrentUnit
                                                  ? "border-amber-950/30 bg-black/10"
                                                  : "border-orange-400/40 bg-black/20"
                                              }`}
                                            >
                                              {isCompleted ? (
                                                <CheckCircle2 className="text-emerald-200" size={22} />
                                              ) : !isUnlocked ? (
                                                <Lock className="text-zinc-500" size={20} />
                                              ) : isCurrentUnit ? (
                                                <Sparkles className="text-amber-950 motion-safe:animate-pulse" size={20} />
                                              ) : (
                                                <ListTodo className="text-amber-100" size={20} />
                                              )}
                                            </div>
                                            {editingUnitId === unit.id ? (
                                              <div className="flex gap-2 items-center flex-1">
                                                <input
                                                  type="text"
                                                  value={editingUnitTitle}
                                                  onChange={(e) => setEditingUnitTitle(e.target.value)}
                                                  className={`flex-1 bg-black/30 border border-orange-400/50 rounded px-2 py-1 text-sm font-bold outline-none ${
                                                    isCompleted ? "text-green-100" : "text-amber-950"
                                                  }`}
                                                  onKeyDown={(e) => {
                                                    if (e.key === "Enter") saveEditUnit();
                                                    if (e.key === "Escape") cancelEditUnit();
                                                  }}
                                                  autoFocus
                                                />
                                                <button
                                                  onClick={saveEditUnit}
                                                  className={`text-sm font-bold ${
                                                    isCompleted ? "text-green-200 hover:text-green-100" : "text-amber-950 hover:text-orange-200"
                                                  }`}
                                                >
                                                  ✓
                                                </button>
                                                <button
                                                  onClick={cancelEditUnit}
                                                  className={`text-sm font-bold ${
                                                    isCompleted ? "text-green-200 hover:text-green-100" : "text-amber-950 hover:text-orange-200"
                                                  }`}
                                                >
                                                  ✕
                                                </button>
                                              </div>
                                            ) : (
                                              <>
                                                <span
                                                  className={`font-bold truncate ${
                                                    isCompleted
                                                      ? "text-emerald-50"
                                                      : !isUnlocked
                                                      ? "text-zinc-500"
                                                      : isCurrentUnit
                                                      ? "text-amber-950 text-lg md:text-xl"
                                                      : isFutureUnit
                                                      ? "text-orange-50"
                                                      : "text-zinc-200"
                                                  }`}
                                                >
                                                  {unit.title}
                                                </span>
                                                <div className="flex gap-2 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                  <select
                                                    onClick={(e) => e.stopPropagation()}
                                                    onChange={(e) => {
                                                      const raw = e.target.value;
                                                      const newDifficulty =
                                                        raw === ""
                                                          ? undefined
                                                          : (raw as "easy" | "medium" | "hard");
                                                      setCourses((prev) =>
                                                        prev.map((c) =>
                                                          c.id === selectedCourseId
                                                            ? {
                                                                ...c,
                                                                units: normalizeUnitsState(
                                                                  c.units.map((u) =>
                                                                    u.id === unit.id
                                                                      ? { ...u, difficulty: newDifficulty }
                                                                      : u
                                                                  )
                                                                ),
                                                              }
                                                            : c
                                                        )
                                                      );
                                                    }}
                                                    value={unit.difficulty || ""}
                                                    className={`px-2 py-1 rounded-lg text-xs font-medium outline-none transition-all ${
                                                      isCompleted
                                                        ? "bg-green-600 hover:bg-green-700 text-white"
                                                        : "bg-orange-500 hover:bg-orange-600 text-white"
                                                    }`}
                                                  >
                                                    <option value="">📊 רמת קושי</option>
                                                    <option value="easy">🟢 קל</option>
                                                    <option value="medium">🟡 בינוני</option>
                                                    <option value="hard">🔴 קשה</option>
                                                  </select>
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      startEditUnit(unit.id, unit.title);
                                                    }}
                                                    className={`${
                                                      isCompleted ? "text-green-200 hover:text-green-100" : "text-amber-900 hover:text-amber-800"
                                                    }`}
                                                  >
                                                    <Pencil size={16} />
                                                  </button>
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      if (confirm('האם אתה בטוח שברצונך למחוק יחידה זו?')) {
                                                        deleteUnit(unit.id);
                                                      }
                                                    }}
                                                    className={`${
                                                      isCompleted ? "text-green-200 hover:text-red-300" : "text-amber-900 hover:text-red-400"
                                                    }`}
                                                  >
                                                    <Trash2 size={16} />
                                                  </button>
                                                </div>
                                              </>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-3">
                                            <div
                                              className={`text-sm font-bold tabular-nums ${
                                                isCompleted
                                                  ? "text-emerald-100"
                                                  : isCurrentUnit
                                                  ? "text-amber-950"
                                                  : isFutureUnit
                                                  ? "text-orange-100"
                                                  : "text-zinc-500"
                                              }`}
                                            >
                                              {isCompleted ? "הושלם!" : taskProgressText}
                                            </div>
                                            <div
                                              className={`text-xs font-bold ${
                                                isCompleted
                                                  ? "text-emerald-200/90"
                                                  : isCurrentUnit
                                                  ? "text-amber-950/90"
                                                  : "text-orange-200/80"
                                              }`}
                                            >
                                              +{unitXP} XP
                                            </div>
                                            {unit.difficulty && (
                                              <div className="text-[10px] font-bold text-white/90">
                                                {unit.difficulty === "easy" && "🟢 קל"}
                                                {unit.difficulty === "medium" && "🟡 בינוני"}
                                                {unit.difficulty === "hard" && "🔴 קשה"}
                                              </div>
                                            )}
                                            {isUnlocked && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  toggleUnitCompletion(unit.id);
                                                }}
                                                className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                                                  unit.completed
                                                    ? "bg-green-600 border-green-600 text-white"
                                                    : "border-orange-400 hover:bg-orange-400/20"
                                                }`}
                                                title={unit.completed ? "סמן כלא הושלם" : "סמן כהושלם"}
                                              >
                                                {unit.completed && <CheckCircle2 size={14} />}
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                        {!isCompleted && (
                                          <div
                                            className={`mt-4 h-2 overflow-hidden rounded-full ${
                                              isCurrentUnit ? "bg-black/25" : "bg-black/30"
                                            }`}
                                          >
                                            <div
                                              className={`h-full rounded-full transition-[width] duration-700 ease-out ${
                                                isCurrentUnit
                                                  ? "bg-amber-950 shadow-[0_0_12px_rgba(251,146,60,0.7)]"
                                                  : isFutureUnit
                                                  ? "bg-orange-400/80"
                                                  : "bg-zinc-600"
                                              }`}
                                              style={{ width: `${progress}%` }}
                                            />
                                          </div>
                                        )}
                                      </div>

                                      {isSelected && (
                                        <div className={`mt-6 ${isCurrentUnit ? 'bg-gradient-to-r from-orange-900/20 to-red-900/20 border-orange-400/40' : 'bg-zinc-900/30 border-orange-400/20'} rounded-2xl p-6 border shadow-[0_0_20px_rgba(251,146,60,0.3)]`}>
                                          <div className="flex justify-between items-center mb-6">
                                            <h4 className="text-orange-200 font-bold text-xl">משימות ביחידה</h4>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setAddingTaskToUnit(unit.id);
                                              }}
                                              className={`px-3 py-1 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
                                                isCompleted
                                                  ? "bg-green-500 hover:bg-green-600 text-white"
                                                  : "bg-orange-500 hover:bg-orange-600 text-white"
                                              }`}
                                              disabled={addingTaskToUnit === unit.id}
                                            >
                                              <Plus size={14} />
                                              הוסף משימה
                                            </button>
                                            {isCurrentUnit && (
                                              <div className="text-sm text-amber-950 font-medium">
                                                יחידה פעילה - המשך ללמוד!
                                              </div>
                                            )}
                                          </div>
                                          
                                          {/* Next Action for Current Unit */}
                                          {isCurrentUnit && unit.tasks.length > 0 && (() => {
                                            const nextTask = unit.tasks.find(task => !task.completed);
                                            return nextTask ? (
                                              <div className="mb-6 p-4 bg-orange-900/30 border border-orange-400/30 rounded-xl">
                                                <div className="flex items-center justify-between">
                                                  <div className="flex items-center gap-3">
                                                    <div className="w-3 h-3 bg-orange-400 rounded-full animate-pulse"></div>
                                                    <div className="min-w-0">
                                                      <div className="text-orange-200 font-medium text-sm">המשימה הבאה:</div>
                                                      <div className="text-white text-sm font-semibold">{nextTask.title}</div>
                                                      <span
                                                        className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${TASK_TYPE_META[coerceTaskType(nextTask.type)].chipClass}`}
                                                      >
                                                        {taskTypeIcon(coerceTaskType(nextTask.type))}
                                                        {TASK_TYPE_META[coerceTaskType(nextTask.type)].label}
                                                      </span>
                                                    </div>
                                                  </div>
                                                  <button
                                                    onClick={() => toggleTask(unit.id, nextTask.id)}
                                                    className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg shadow-[0_0_10px_rgba(251,146,60,0.4)] hover:shadow-[0_0_15px_rgba(251,146,60,0.6)] transition-all font-medium"
                                                  >
                                                    המשך ללמוד
                                                  </button>
                                                </div>
                                              </div>
                                            ) : null;
                                          })()}
                                          
                                          {/* Tasks Checklist */}
                                          <div className="space-y-2">
                                            {unit.tasks.map((task, taskIndex) => (
                                              <div key={task.id}>
                                                {editingTaskId === task.id ? (
                                                  <div className="p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl">
                                                    <div className="space-y-3">
                                                      <input
                                                        type="text"
                                                        placeholder="תיאור המשימה..."
                                                        className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-orange-400"
                                                        value={editingTaskTitle}
                                                        onChange={(e) => setEditingTaskTitle(e.target.value)}
                                                        onKeyDown={(e) => e.key === "Enter" && saveEditTask()}
                                                        autoFocus
                                                      />
                                                      <div className="flex gap-2">
                                                        <select
                                                          className="bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-400"
                                                          value={editingTaskType}
                                                          onChange={(e) =>
                                                            setEditingTaskType(coerceTaskType(e.target.value))
                                                          }
                                                        >
                                                          <option value="watch">צפייה</option>
                                                          <option value="read">קריאה</option>
                                                          <option value="exercise">תרגול</option>
                                                          <option value="general">כללי</option>
                                                        </select>
                                                        <button
                                                          onClick={saveEditTask}
                                                          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg shadow-[0_0_10px_rgba(251,146,60,0.4)] hover:shadow-[0_0_15px_rgba(251,146,60,0.6)] transition-all"
                                                        >
                                                          שמור
                                                        </button>
                                                        <button
                                                          onClick={cancelEditTask}
                                                          className="bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded-lg"
                                                        >
                                                          ביטול
                                                        </button>
                                                      </div>
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <div
                                                    onMouseDown={(e) => startLongPress(unit.id, task.id, e)}
                                                    onTouchStart={(e) => startLongPress(unit.id, task.id, e)}
                                                
                                                    onMouseEnter={() => {
                                                      if (isActiveDrag && draggingTaskId && draggingTaskId !== task.id) {
                                                        setHoveredTargetTaskId(task.id);
                                                      }
                                                    }}
                                                    onMouseLeave={() => {
                                                      if (isActiveDrag) {
                                                        setHoveredTargetTaskId(null);
                                                      }
                                                    }}
                                                    onMouseMove={(e) => handleTaskMouseMove(e)}
                                                    onTouchMove={(e) => handleTaskMouseMove(e)}
                                                    onMouseUp={(e) => {
                                                      if (isActiveDrag && hoveredTargetTaskId) {
                                                        handleTaskDrop(unit.id, hoveredTargetTaskId);
                                                      }
                                                      endLongPress();
                                                    }}
                                                    onTouchEnd={(e) => {
                                                      if (isActiveDrag && hoveredTargetTaskId) {
                                                        handleTaskDrop(unit.id, hoveredTargetTaskId);
                                                      }
                                                      endLongPress();
                                                    }}
                                                    className={`flex flex-wrap items-center gap-3 p-3 rounded-xl transition-all duration-300 group motion-safe:hover:border-orange-500/25 ${
                                                      isActiveDrag && draggingTaskId === task.id
                                                        ? "bg-orange-500/30 border border-orange-400 shadow-[0_0_20px_rgba(251,146,60,0.4)] scale-105 cursor-grabbing"
                                                        : hoveredTargetTaskId === task.id && isActiveDrag
                                                          ? "bg-orange-400/20 border-2 border-orange-300 shadow-[0_0_15px_rgba(251,146,60,0.3)]"
                                                          : draggingTaskId && draggingFromUnitId === unit.id && isActiveDrag
                                                            ? "opacity-40"
                                                            : task.completed
                                                              ? "bg-emerald-950/40 border border-emerald-600/35 cursor-grab"
                                                              : isCurrentUnit &&
                                                                  taskIndex ===
                                                                    unit.tasks.findIndex((t) => !t.completed)
                                                                ? "bg-orange-950/30 border border-orange-400/45 shadow-[0_0_14px_rgba(251,146,60,0.2)] cursor-grab"
                                                                : "bg-zinc-900/60 border border-zinc-800 hover:bg-zinc-800/80 cursor-grab"
                                                    }`}
                                                  >
                                                    <div
                                                      onClick={() => toggleTask(unit.id, task.id)}
                                                      className={`w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center cursor-pointer transition-all duration-200 ${
                                                        task.completed
                                                          ? "bg-emerald-600 border-emerald-500"
                                                          : "border-zinc-600 hover:border-orange-400 hover:scale-105"
                                                      }`}
                                                    >
                                                      {task.completed && <CheckCircle2 size={14} className="text-white" />}
                                                    </div>
                                                    <span
                                                      className={`text-sm flex-1 min-w-[40%] ${
                                                        task.completed
                                                          ? "text-emerald-300/90 line-through"
                                                          : "text-white"
                                                      }`}
                                                    >
                                                      {task.title}
                                                    </span>
                                                    <span
                                                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${TASK_TYPE_META[coerceTaskType(task.type)].chipClass}`}
                                                    >
                                                      {taskTypeIcon(coerceTaskType(task.type))}
                                                      {TASK_TYPE_META[coerceTaskType(task.type)].label}
                                                    </span>
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          startEditTask(unit.id, task.id, task.title, task.type);
                                                        }}
                                                        className="text-zinc-500 hover:text-orange-400"
                                                      >
                                                        <Pencil size={14} />
                                                      </button>
                                                      <button
                                                        onClick={() => deleteTask(unit.id, task.id)}
                                                        className="text-zinc-500 hover:text-red-400"
                                                      >
                                                        <Trash2 size={14} />
                                                      </button>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            ))}
                                          </div>

                                          {/* Add Task Form */}
                                          {addingTaskToUnit === unit.id && (
                                            <div className="mt-4 p-4 bg-zinc-900/50 border border-zinc-700 rounded-xl">
                                              <div className="space-y-3">
                                                <input
                                                  type="text"
                                                  placeholder="תיאור המשימה..."
                                                  className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-orange-400"
                                                  value={newTaskTitle}
                                                  onChange={(e) => setNewTaskTitle(e.target.value)}
                                                  onKeyDown={(e) => e.key === "Enter" && addTaskToUnit(unit.id)}
                                                  autoFocus
                                                />
                                                <div className="flex gap-2">
                                                  <select
                                                    className="bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-400"
                                                    value={newTaskType}
                                                    onChange={(e) =>
                                                      setNewTaskType(coerceTaskType(e.target.value))
                                                    }
                                                  >
                                                    <option value="watch">צפייה</option>
                                                    <option value="read">קריאה</option>
                                                    <option value="exercise">תרגול</option>
                                                    <option value="general">כללי</option>
                                                  </select>
                                                  <button
                                                    onClick={() => addTaskToUnit(unit.id)}
                                                    className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg shadow-[0_0_10px_rgba(251,146,60,0.4)] hover:shadow-[0_0_15px_rgba(251,146,60,0.6)] transition-all"
                                                  >
                                                    <Plus size={16} />
                                                  </button>
                                                  <button
                                                    onClick={() => {
                                                      setAddingTaskToUnit(null);
                                                      setNewTaskTitle("");
                                                      setNewTaskType("general");
                                                    }}
                                                    className="bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded-lg"
                                                  >
                                                    ביטול
                                                  </button>
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                {course.units.length === 0 && (
                                  <p className="text-amber-900/60 text-center py-6">אין יחידות עדיין</p>
                                )}
                                
                                {/* Add Unit Button */}
                                <div className="mt-6 flex justify-center">
                                  <button
                                    onClick={() => {
                                      const newUnitId = `unit-${Date.now()}`;
                                      setCourses((prev) =>
                                        prev.map((c) =>
                                          c.id === selectedCourseId
                                            ? {
                                                ...c,
                                                units: normalizeUnitsState([
                                                  ...c.units,
                                                  {
                                                    id: newUnitId,
                                                    title: `יחידה חדשה`,
                                                    tasks: [],
                                                    progress: 0,
                                                    completed: false,
                                                    unlocked: false,
                                                    difficulty: "medium",
                                                  },
                                                ]),
                                              }
                                            : c
                                        )
                                      );
                                      setEditingUnitId(newUnitId);
                                      setEditingUnitTitle("יחידה חדשה");
                                    }}
                                    className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl shadow-[0_0_15px_rgba(251,146,60,0.4)] hover:shadow-[0_0_20px_rgba(251,146,60,0.6)] transition-all flex items-center gap-2"
                                  >
                                    <Plus size={20} />
                                    הוסף יחידה
                                  </button>
                                </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {courseTab === "dates" && (
                        <div className="grid grid-cols-12 gap-8">
                          {/* Important Dates Section */}
                          <div className="col-span-12">
                            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
                              <h3 className="text-2xl font-bold text-white mb-6">תאריכים חשובים</h3>
                              
                              <div className="mb-6 space-y-2">
                                <input
                                  type="text"
                                  placeholder="שם (מטלה, מבחן, וכו')..."
                                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-blue-500"
                                  value={newDateTitle}
                                  onChange={(e) => setNewDateTitle(e.target.value)}
                                />
                                <div className="flex gap-2">
                                  <input
                                    type="date"
                                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-white outline-none focus:border-blue-500"
                                    value={newDateValue}
                                    onChange={(e) => setNewDateValue(e.target.value)}
                                  />
                                  <select
                                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                    value={newDateType}
                                    onChange={(e) => setNewDateType(e.target.value as "assignment" | "exam" | "other")}
                                  >
                                    <option value="assignment">מטלה</option>
                                    <option value="exam">מבחן</option>
                                    <option value="other">אחר</option>
                                  </select>
                                  <button
                                    onClick={addImportantDate}
                                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg shadow-[0_0_10px_rgba(59,130,246,0.4)] hover:shadow-[0_0_15px_rgba(59,130,246,0.6)] transition-all"
                                  >
                                    <Plus size={20} />
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-3">
                                {course.importantDates.map((date) => (
                                  <div
                                    key={date.id}
                                    className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 flex justify-between items-center group hover:bg-zinc-750 transition-all"
                                  >
                                    <div>
                                      <h4 className="text-white font-bold">{date.title}</h4>
                                      <p className="text-zinc-400 text-sm">{date.date}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                        date.type === "exam" ? "bg-red-900/50 text-red-400" :
                                        date.type === "assignment" ? "bg-blue-900/50 text-blue-400" :
                                        "bg-zinc-700 text-zinc-300"
                                      }`}>
                                        {date.type === "exam" ? "מבחן" :
                                         date.type === "assignment" ? "מטלה" : "אחר"}
                                      </span>
                                      <button
                                        onClick={() => deleteImportantDate(date.id)}
                                        className="text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                                {course.importantDates.length === 0 && (
                                  <p className="text-zinc-500 text-center py-6">אין תאריכים חשובים</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {courseTab === "study-time" && (() => {
                        const { start: wStart, end: wEnd } = weekBoundsSunday();
                        const weekSec = sumSecondsForCourseInWeek(
                          universityStudy.entries,
                          course.id,
                          wStart,
                          wEnd
                        );
                        const totalSec = sumAllSecondsForCourse(universityStudy.entries, course.id);
                        const dailyAvgWeekSec = weekSec / 7;
                        const monthDayCells = uniStudyMonthDays.filter(
                          (d): d is NonNullable<(typeof uniStudyMonthDays)[number]> => d !== null
                        );
                        const monthKeys = monthDayCells.map((d) => d.key).sort();
                        const daysWithLog = monthKeys.filter(
                          (k) =>
                            secondsForCourseOnDate(universityStudy.entries, course.id, k) > 0
                        );

                        return (
                          <div className="grid grid-cols-12 gap-8">
                            <div className="col-span-12 space-y-8">
                              <div className="flex flex-wrap gap-4">
                                <div className="flex-1 min-w-[200px] rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
                                  <p className="text-xs font-bold text-emerald-400/90 uppercase tracking-wider mb-1">
                                    ממוצע יומי השבוע
                                  </p>
                                  <p className="text-2xl font-black text-white">
                                    {formatStudyDuration(Math.round(dailyAvgWeekSec))}
                                  </p>
                                  <p className="text-xs text-zinc-500 mt-2">
                                    מחושב על 7 ימים (א׳–ש׳), לפי זמני לימוד שנשמרו לקורס זה
                                  </p>
                                </div>
                                <div className="flex-1 min-w-[200px] rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
                                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
                                    סה״כ השבוע בקורס
                                  </p>
                                  <p className="text-2xl font-black text-white">
                                    {formatStudyDuration(weekSec)}
                                  </p>
                                </div>
                                <div className="flex-1 min-w-[200px] rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5">
                                  <p className="text-xs font-bold text-violet-400/80 uppercase tracking-wider mb-1">
                                    סה״כ בכלל
                                  </p>
                                  <p className="text-2xl font-black text-white">
                                    {formatStudyDuration(totalSec)}
                                  </p>
                                  <p className="text-xs text-zinc-500 mt-2">
                                    כלל שעות הלימוד בקורס מאז ומעולם
                                  </p>
                                </div>
                              </div>

                              <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
                                <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
                                  <div>
                                    <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                                      <CalendarIcon className="text-emerald-400" size={26} />
                                      לוח שנה — לחץ על יום לטיימר
                                    </h3>
                                    <p className="text-sm text-zinc-500 mt-1">
                                      {new Date(uniStudyYear, uniStudyMonth).toLocaleDateString(
                                        "he-IL",
                                        { month: "long", year: "numeric" }
                                      )}
                                    </p>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (uniStudyMonth === 0) {
                                          setUniStudyMonth(11);
                                          setUniStudyYear((y) => y - 1);
                                        } else setUniStudyMonth((m) => m - 1);
                                      }}
                                      className="p-2 rounded-xl border border-zinc-800 hover:bg-zinc-800 transition-colors"
                                    >
                                      <ChevronRight size={20} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (uniStudyMonth === 11) {
                                          setUniStudyMonth(0);
                                          setUniStudyYear((y) => y + 1);
                                        } else setUniStudyMonth((m) => m + 1);
                                      }}
                                      className="p-2 rounded-xl border border-zinc-800 hover:bg-zinc-800 transition-colors"
                                    >
                                      <ChevronLeft size={20} />
                                    </button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-7 gap-2 md:gap-3" dir="ltr">
                                  {["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"].map((d, i) => (
                                    <div
                                      key={`wd-${i}`}
                                      className="text-center text-[10px] font-black text-zinc-600 mb-1 tracking-widest"
                                    >
                                      {d}
                                    </div>
                                  ))}
                                  {uniStudyMonthDays.map((day, idx) => {
                                    if (!day) return <div key={`e-${idx}`} />;
                                    const sec = secondsForCourseOnDate(
                                      universityStudy.entries,
                                      course.id,
                                      day.key
                                    );
                                    const hasStudy = sec > 0;
                                    return (
                                      <button
                                        key={day.key}
                                        type="button"
                                        disabled={day.isFuture}
                                        onClick={() => {
                                          if (day.isFuture) return;
                                          setStudyTimerOpen({
                                            date: day.key,
                                            courseId: course.id,
                                          });
                                        }}
                                        className={`aspect-square rounded-2xl border flex flex-col items-center justify-center text-sm font-bold transition-all relative
                                          ${
                                            day.isFuture
                                              ? "bg-transparent border-zinc-900 text-zinc-800 cursor-not-allowed"
                                              : hasStudy
                                              ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-200 hover:bg-emerald-500/25"
                                              : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-emerald-500/40 hover:bg-zinc-800"
                                          }
                                          ${day.isToday ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#0c0c0c]" : ""}
                                        `}
                                      >
                                        <span>{day.dayNumber}</span>
                                        {hasStudy && !day.isFuture && (
                                          <span className="text-[8px] md:text-[9px] font-bold text-emerald-400/90 mt-0.5 tabular-nums leading-tight text-center px-0.5 max-w-full break-words">
                                            {formatStudyDuration(sec)}
                                          </span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
                                <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                  <Timer size={18} className="text-zinc-400" />
                                  פירוט ימים בחודש (קורס זה)
                                </h4>
                                {daysWithLog.length === 0 ? (
                                  <p className="text-zinc-500 text-center py-6">
                                    עדיין אין רישומי לימוד בחודש הזה. בחר יום בלוח והתחל טיימר.
                                  </p>
                                ) : (
                                  <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                    {daysWithLog
                                      .slice()
                                      .reverse()
                                      .map((k) => (
                                        <li
                                          key={k}
                                          className="flex justify-between items-center rounded-xl bg-zinc-950/80 border border-zinc-800/80 px-4 py-3"
                                        >
                                          <span className="text-zinc-300">
                                            {new Date(k + "T12:00:00").toLocaleDateString("he-IL", {
                                              weekday: "short",
                                              day: "numeric",
                                              month: "long",
                                            })}
                                          </span>
                                          <span className="font-black text-emerald-400 tabular-nums">
                                            {formatStudyDuration(
                                              secondsForCourseOnDate(
                                                universityStudy.entries,
                                                course.id,
                                                k
                                              )
                                            )}
                                          </span>
                                        </li>
                                      ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}
              </div>
            )}

            {activePage === "university" && !selectedCourseId && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <header className="mb-12 flex justify-between items-end">
                  <div>
                    <h2 className="text-4xl font-black tracking-tight text-white mb-2">
                      מרכז האוניברסיטה
                    </h2>
                    <p className="text-zinc-400 text-lg">
                      "למידה היא האור שמאיר את הדרך."
                    </p>
                  </div>

                  <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl flex gap-3 items-center">
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="שם הקורס..."
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-blue-500 transition-colors"
                        value={newCourseName}
                        onChange={(e) => setNewCourseName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addCourse()}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-zinc-400 font-semibold">צבע:</label>
                      <input
                        type="color"
                        value={newCourseColor}
                        onChange={(e) => setNewCourseColor(e.target.value)}
                        className="w-12 h-12 rounded-lg border-2 border-zinc-600 cursor-pointer"
                      />
                    </div>
                    <button
                      className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors"
                      onClick={addCourse}
                      type="button"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </header>

                {courses.length > 0 && (
                  <section className="mb-12 rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6 overflow-x-auto">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                      <h3 className="text-xl font-black text-white flex items-center gap-2">
                        <Timer className="text-cyan-400 shrink-0" size={22} />
                        כמה למדתי — 7 הימים האחרונים
                      </h3>
                      <div className="text-sm text-zinc-400">
                        <span className="text-zinc-500">ממוצע יומי השבוע (כל הקורסים): </span>
                        <span className="text-white font-bold tabular-nums">
                          {formatStudyDuration(
                            Math.round(
                              sumSecondsAllInWeek(
                                universityStudy.entries,
                                weekBoundsSunday().start,
                                weekBoundsSunday().end
                              ) / 7
                            )
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="min-w-[720px]">
                      <div className="grid grid-cols-[minmax(100px,140px)_repeat(7,minmax(0,1fr))] gap-2 text-xs">
                        <div className="text-zinc-600 font-bold py-2 px-1">קורס</div>
                        {getLast7DateKeys().map((k) => (
                          <div
                            key={k}
                            className="text-center font-bold text-zinc-500 py-2 px-0.5 leading-tight"
                          >
                            {new Date(k + "T12:00:00").toLocaleDateString("he-IL", {
                              weekday: "short",
                              day: "numeric",
                              month: "numeric",
                            })}
                          </div>
                        ))}
                        {courses.map((c) => (
                          <div key={c.id} className="contents">
                            <div className="flex items-center gap-2 py-2 px-1 min-w-0 border-t border-zinc-800/60">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ background: c.color }}
                              />
                              <span className="truncate text-sm font-bold text-zinc-200">{c.name}</span>
                            </div>
                            {getLast7DateKeys().map((k) => {
                              const sec = secondsForCourseOnDate(universityStudy.entries, c.id, k);
                              return (
                                <div
                                  key={`${c.id}-${k}`}
                                  className={`text-center text-sm font-semibold py-2 px-1 rounded-lg border flex items-center justify-center min-h-[2.5rem] ${
                                    sec > 0
                                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                                      : "border-zinc-800/80 bg-zinc-950/50 text-zinc-600"
                                  }`}
                                >
                                  {sec > 0 ? formatStudyDuration(sec) : "—"}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                        <div className="flex items-center gap-2 py-2 px-1 font-bold text-zinc-300 border-t border-zinc-800">
                          סה״כ יום
                        </div>
                        {getLast7DateKeys().map((k) => (
                          <div
                            key={`tot-${k}`}
                            className="text-center text-sm font-black py-2 px-1 rounded-lg border border-zinc-700/80 bg-zinc-900/80 text-amber-200/90"
                          >
                            {formatStudyDuration(secondsAllCoursesOnDate(universityStudy.entries, k))}
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="mt-4 text-xs text-zinc-600">
                      לטיימר ורישום זמן נכנסים לקורס → טאב &quot;זמן לימוד&quot; → לוח שנה.
                    </p>
                  </section>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {courses.map((course) => (
                    <div
                      key={course.id}
                      onClick={() => setSelectedCourseId(course.id)}
                      className="group relative rounded-3xl overflow-hidden shadow-lg hover:shadow-xl transition-all cursor-pointer"
                      style={{ backgroundColor: course.color }}
                    >
                      <div className="p-6 text-white h-full flex flex-col justify-between">
                        <div>
                          {editingCourseId === course.id ? (
                            <div className="flex gap-2 items-center mb-2">
                              <input
                                type="text"
                                value={editingCourseName}
                                onChange={(e) => setEditingCourseName(e.target.value)}
                                className="bg-white/20 border border-white/40 rounded px-2 py-1 text-sm flex-1 text-white"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEditCourse();
                                  if (e.key === "Escape") cancelEditCourse();
                                }}
                                autoFocus
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  saveEditCourse();
                                }}
                                className="text-green-300 hover:text-green-100"
                              >
                                ✓
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelEditCourse();
                                }}
                                className="text-red-300 hover:text-red-100"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <h3 className="text-2xl font-bold mb-2">{course.name}</h3>
                          )}
                          <p className="text-sm opacity-80">קורס אוניברסיטאי</p>
                        </div>
                        <div>
                          <div className="h-1 bg-white/30 rounded mt-4 mb-4"></div>
                          <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() =>
                                startEditCourse(course.id, course.name)
                              }
                              className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg text-xs flex items-center gap-1"
                            >
                              <Pencil size={14} />
                              עריכה
                            </button>
                            <button
                              onClick={() => deleteCourse(course.id)}
                              className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg text-xs flex items-center gap-1"
                            >
                              <Trash2 size={14} />
                              מחיקה
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {courses.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-zinc-500 text-lg">אין קורסים עדיין. הוסף קורס ראשון!</p>
                  </div>
                )}
              </div>
            )}

            {activePage === "school" && (
              <div className="space-y-8">
                <header>
                  <h2 className="text-3xl font-black tracking-tight text-white md:text-4xl">בית הספר</h2>
                  <p className="mt-1 text-sm text-zinc-500 md:text-base">
                    כל המבחנים, שיעורי הבית והנושאים — מסודרים לפי תאריך ובמקום אחד.
                  </p>
                </header>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
                    <div className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">
                      להיום
                    </div>
                    <div className="text-2xl font-black text-white md:text-3xl">
                      {
                        schoolData.assignments.filter((a) => {
                          const today = new Date().toISOString().split("T")[0];
                          return a.dueDate === today && !a.completed;
                        }).length
                      }
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">מטלות להגשה היום</div>
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
                    <div className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">
                      מבחנים קרובים
                    </div>
                    <div className="text-2xl font-black text-orange-400 md:text-3xl">
                      {schoolData.exams.filter((e) => e.status === "upcoming").length}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">בכל המקצועות</div>
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
                    <div className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">
                      מטלות פתוחות
                    </div>
                    <div className="text-2xl font-black text-amber-300 md:text-3xl">
                      {schoolData.assignments.filter((a) => !a.completed).length}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">שיעורי בית ועוד</div>
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
                    <div className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">
                      התקדמות ממוצעת
                    </div>
                    <div className="text-2xl font-black text-emerald-400 md:text-3xl">
                      {Math.round(
                        schoolData.subjects.reduce((sum, s) => sum + s.progress, 0) /
                          Math.max(schoolData.subjects.length, 1)
                      )}
                      %
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">על פי כל המקצועות</div>
                  </div>
                </div>

                {selectedSchoolSubjectId ? (
                  (() => {
                    const subject = schoolData.subjects.find((s) => s.id === selectedSchoolSubjectId);
                    if (!subject) return null;

                    const subjectAssignments = schoolData.assignments.filter((a) => a.subjectId === subject.id);
                    const subjectExams = schoolData.exams
                      .filter((e) => e.subjectId === subject.id)
                      .slice()
                      .sort((a, b) => schoolDayTime(a.date) - schoolDayTime(b.date));
                    const subjectNotes = schoolData.notes.filter((n) => n.subjectId === subject.id);
                    const subjectAgenda = buildSchoolAgenda(schoolData, subject.id);

                    const todayKey = new Date().toISOString().split("T")[0];

                    const subjectTabBtn = (
                      id: "schedule" | "homework" | "exams" | "notes",
                      label: string,
                      Icon: typeof CalendarIcon
                    ) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSchoolSubjectTab(id)}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all md:text-sm min-w-[7rem] ${
                          schoolSubjectTab === id
                            ? "bg-orange-500 text-white shadow-[0_0_20px_rgba(251,146,60,0.35)]"
                            : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                        }`}
                      >
                        <Icon size={16} className="shrink-0 opacity-90" />
                        {label}
                      </button>
                    );

                    return (
                      <div className="space-y-6">
                        <button
                          type="button"
                          onClick={() => setSelectedSchoolSubjectId(null)}
                          className="flex items-center gap-2 text-sm font-semibold text-zinc-500 transition-colors hover:text-white"
                        >
                          ← חזור לכל המקצועות
                        </button>

                        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6 shadow-[0_0_40px_rgba(0,0,0,0.35)] md:p-8">
                          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <h3 className="text-3xl font-black md:text-4xl" style={{ color: subject.color }}>
                                {subject.name}
                              </h3>
                              {subject.teacher && (
                                <p className="mt-1 text-sm text-zinc-500">מורה: {subject.teacher}</p>
                              )}
                            </div>
                          </div>

                          <div className="mb-8">
                            <div className="mb-2 flex items-center justify-between text-sm">
                              <span className="text-zinc-400">התקדמות</span>
                              <span className="font-bold text-white">{subject.progress}%</span>
                            </div>
                            <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${subject.progress}%`, backgroundColor: subject.color }}
                              />
                            </div>
                          </div>

                          <div className="mb-8 flex flex-wrap gap-2 rounded-2xl border border-zinc-800 bg-black/30 p-1.5">
                            {subjectTabBtn("schedule", "לו״ז משולב", CalendarDays)}
                            {subjectTabBtn("homework", "שיעורי בית", ClipboardList)}
                            {subjectTabBtn("exams", "מבחנים", CalendarIcon)}
                            {subjectTabBtn("notes", "עד 20 ביוני", BookMarked)}
                          </div>

                          {schoolSubjectTab === "schedule" && (
                            <div className="space-y-3">
                              <p className="text-sm text-zinc-500">
                                כל תאריכי המבחנים וההגשות של המקצוע הזה, לפי סדר כרונולוגי.
                              </p>
                              {subjectAgenda.length === 0 ? (
                                <p className="rounded-2xl border border-zinc-800 bg-zinc-950/50 py-10 text-center text-zinc-500">
                                  אין מבחנים או מטלות פתוחות במקצוע הזה.
                                </p>
                              ) : (
                                <ul className="relative space-y-2 before:absolute before:top-2 before:bottom-2 before:w-px before:bg-zinc-800 before:start-4 md:before:start-5">
                                  {subjectAgenda.map((row) => {
                                    const dateStr =
                                      row.kind === "exam"
                                        ? row.exam.date
                                        : row.assignment.dueDate;
                                    const label =
                                      row.kind === "exam"
                                        ? row.exam.title
                                        : row.assignment.title;
                                    const days = Math.round(
                                      (schoolDayTime(dateStr) - schoolDayTime(todayKey)) / 86400000
                                    );
                                    return (
                                      <li
                                        key={`${row.kind}-${row.id}`}
                                        className="relative flex flex-wrap items-start gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 py-3 pe-4 ps-12 md:ps-14"
                                      >
                                        <span
                                          className="absolute start-3 top-3 flex h-4 w-4 rounded-full border-2 border-zinc-950 md:start-4"
                                          style={{
                                            backgroundColor:
                                              row.kind === "exam" ? subject.color : `${subject.color}88`,
                                          }}
                                        />
                                        <div className="min-w-0 flex-1">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span
                                              className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                                                row.kind === "exam"
                                                  ? "bg-blue-500/20 text-blue-200"
                                                  : "bg-amber-500/15 text-amber-200"
                                              }`}
                                            >
                                              {row.kind === "exam" ? "מבחן" : "מטלה"}
                                            </span>
                                            <span className="text-xs font-bold tabular-nums text-zinc-400">
                                              {new Date(dateStr + "T12:00:00").toLocaleDateString("he-IL", {
                                                weekday: "short",
                                                day: "numeric",
                                                month: "short",
                                                year: "numeric",
                                              })}
                                            </span>
                                            <span className="text-xs text-zinc-600">
                                              {days === 0
                                                ? "היום"
                                                : days > 0
                                                  ? `בעוד ${days} ימים`
                                                  : `לפני ${Math.abs(days)} ימים`}
                                            </span>
                                          </div>
                                          <p className="mt-1 font-bold text-white">{label}</p>
                                          {row.kind === "exam" && row.exam.notes && (
                                            <p className="mt-1 text-xs text-zinc-500">{row.exam.notes}</p>
                                          )}
                                          {row.kind === "assignment" && (
                                            <p className="mt-1 text-xs text-zinc-500">
                                              {SCHOOL_ASSIGNMENT_TYPE_HE[row.assignment.type]} •{" "}
                                              {row.assignment.priority === "high" && "דחיפות גבוהה"}
                                              {row.assignment.priority === "medium" && "דחיפות בינונית"}
                                              {row.assignment.priority === "low" && "דחיפות רגילה"}
                                            </p>
                                          )}
                                        </div>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </div>
                          )}

                         {schoolSubjectTab === "homework" && (
  <div className="space-y-4">
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950/60 p-5 space-y-3">
      <h4 className="text-lg font-bold text-white">הוסף שיעורי בית</h4>

      <input
        type="text"
        placeholder="שם המשימה"
        value={newAssignmentTitle}
        onChange={(e) => setNewAssignmentTitle(e.target.value)}
        className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-blue-500"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          type="date"
          value={newAssignmentDue}
          onChange={(e) => setNewAssignmentDue(e.target.value)}
          className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-blue-500"
        />

        <select
          value={newAssignmentType}
          onChange={(e) => setNewAssignmentType(e.target.value as SchoolAssignment["type"])}
          className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-blue-500"
        >
          <option value="homework">שיעורי בית</option>
          <option value="reading">קריאה</option>
          <option value="worksheet">דף עבודה</option>
          <option value="project">פרויקט</option>
          <option value="study">לימוד</option>
        </select>

        <select
          value={newAssignmentPriority}
          onChange={(e) => setNewAssignmentPriority(e.target.value as "low" | "medium" | "high")}
          className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-blue-500"
        >
          <option value="low">עדיפות נמוכה</option>
          <option value="medium">עדיפות בינונית</option>
          <option value="high">עדיפות גבוהה</option>
        </select>
      </div>

      <button
        onClick={addSchoolAssignment}
        className="rounded-2xl bg-blue-500 px-5 py-3 font-bold text-white hover:bg-blue-600 transition-colors"
        type="button"
      >
        הוסף שיעורי בית
      </button>
    </div>

    <div className="space-y-3">
      {schoolData.assignments
        .filter((a) => a.subjectId === selectedSchoolSubjectId)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .map((a) => (
          <div
            key={a.id}
            className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 flex items-center justify-between gap-4"
          >
            <div>
              <div className={`font-bold ${a.completed ? "line-through text-zinc-500" : "text-white"}`}>
                {a.title}
              </div>
              <div className="text-sm text-zinc-500">
                {SCHOOL_ASSIGNMENT_TYPE_HE[a.type]} · להגשה עד {a.dueDate}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => toggleAssignmentCompleted(a.id)}
                className="rounded-xl bg-emerald-500/20 px-3 py-2 text-emerald-300 hover:bg-emerald-500/30"
                type="button"
              >
                {a.completed ? "בטל סימון" : "בוצע"}
              </button>

              <button
                onClick={() => deleteSchoolAssignment(a.id)}
                className="rounded-xl bg-red-500/20 px-3 py-2 text-red-300 hover:bg-red-500/30"
                type="button"
              >
                מחק
              </button>
            </div>
          </div>
        ))}
    </div>
  </div>
)}

                       {schoolSubjectTab === "exams" && (
  <div className="space-y-4">
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950/60 p-5 space-y-3">
      <h4 className="text-lg font-bold text-white">הוסף מבחן</h4>

      <input
        type="text"
        placeholder="שם המבחן"
        value={newExamTitle}
        onChange={(e) => setNewExamTitle(e.target.value)}
        className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-blue-500"
      />

      <input
        type="date"
        value={newExamDate}
        onChange={(e) => setNewExamDate(e.target.value)}
        className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-blue-500"
      />

      <textarea
        placeholder="הערות למבחן"
        value={newExamNotes}
        onChange={(e) => setNewExamNotes(e.target.value)}
        className="w-full min-h-[100px] rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-blue-500"
      />

      <button
        onClick={addSchoolExam}
        className="rounded-2xl bg-blue-500 px-5 py-3 font-bold text-white hover:bg-blue-600 transition-colors"
        type="button"
      >
        הוסף מבחן
      </button>
    </div>

    <div className="space-y-3">
      {schoolData.exams
        .filter((e) => e.subjectId === selectedSchoolSubjectId)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((exam) => (
          <div
            key={exam.id}
            className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 flex items-center justify-between gap-4"
          >
            <div>
              <div className="font-bold text-white">{exam.title}</div>
              <div className="text-sm text-zinc-500">מבחן בתאריך {exam.date}</div>
              {exam.notes && <div className="text-sm text-zinc-400 mt-1">{exam.notes}</div>}
            </div>

            <button
              onClick={() => deleteSchoolExam(exam.id)}
              className="rounded-xl bg-red-500/20 px-3 py-2 text-red-300 hover:bg-red-500/30"
              type="button"
            >
              מחק
            </button>
          </div>
        ))}
    </div>
  </div>
)}

           {schoolSubjectTab === "notes" && (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/60 p-5">
        <p className="text-sm text-zinc-500 mb-2">ימים ברוטו עד 20 ביוני</p>
        <div className="text-3xl font-black text-white">{grossDaysLeft}</div>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/60 p-5">
        <p className="text-sm text-zinc-500 mb-2">ימים נטו ללימודים</p>
        <div className="text-3xl font-black text-white">{netDaysLeft}</div>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/60 p-5">
        <p className="text-sm text-zinc-500 mb-2">תאריך סיום</p>
        <div className="text-2xl font-black text-white">20/6</div>
      </div>
    </div>

    <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/60 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-xl font-black text-white">לוח זמנים עד סוף השנה</h4>
        <span className="text-xs text-zinc-500">כל יום שעובר מסומן אוטומטית</span>
      </div>

      <div className="grid grid-cols-4 md:grid-cols-7 lg:grid-cols-10 gap-3">
        {schoolTimelineDays.map((day) => (
          <div
            key={day.key}
            className={`relative rounded-2xl border p-3 text-center transition-all overflow-hidden ${
              day.isToday
                ? "border-blue-500 bg-blue-500/10 text-blue-300"
                : day.isPassed
                ? "border-zinc-700 bg-zinc-900 text-zinc-500"
                : day.isWeekend
                ? "border-zinc-800 bg-zinc-950/70 text-zinc-700"
                : "border-zinc-800 bg-zinc-950 text-white"
            }`}
          >
            {(day.isPassed || day.isToday) && (
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute top-1/2 left-[-10%] w-[120%] h-[2px] bg-zinc-300/70 rotate-[-12deg]" />
                <div className="absolute top-1/2 left-[-10%] w-[120%] h-[2px] bg-zinc-400/30 rotate-[12deg]" />
              </div>
            )}

            <div className="relative z-10">
              <div className="text-xs font-bold">{day.label}</div>
              <div className="mt-1 text-[10px]">
                {day.isToday
                  ? "היום"
                  : day.isWeekend
                  ? "סופ״ש"
                  : day.isPassed
                  ? "עבר"
                  : "נותר"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
)}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="space-y-8">
                    <div className="flex flex-wrap gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-1.5">
                      {(
                        [
                          { id: "overview" as const, label: "סקירה ולו״ז", Icon: LayoutDashboard },
                          { id: "countdown" as const, label: "ימים שנשארו", Icon: CalendarIcon },
                          { id: "exams" as const, label: "כל המבחנים", Icon: CalendarDays },
                          { id: "homework" as const, label: "כל שיעורי הבית", Icon: ClipboardList },
                          { id: "topics" as const, label: "נושאים והערות", Icon: BookMarked },
                        ] as const
                      ).map(({ id, label, Icon }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setSchoolHubTab(id)}
                          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all md:min-w-0 md:text-sm ${
                            schoolHubTab === id
                              ? "bg-orange-500 text-white shadow-[0_0_24px_rgba(251,146,60,0.3)]"
                              : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                          }`}
                        >
                          <Icon size={17} className="shrink-0 opacity-90" />
                          {label}
                        </button>
                      ))}
                    </div>

                    {schoolHubTab === "overview" && (
                      <div className="space-y-10">
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
                          <section className="rounded-3xl border border-zinc-800 bg-zinc-900/35 p-6 md:p-8 lg:col-span-2">
                            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                              <div>
                                <h3 className="flex items-center gap-2 text-xl font-black text-white md:text-2xl">
                                  <CalendarDays className="text-orange-400" size={24} />
                                  לו״ז משולב — כל המקצועות
                                </h3>
                                <p className="mt-1 text-sm text-zinc-500">
                                  מבחנים ומטלות פתוחות לפי תאריך (מהקרוב לרחוק).
                                </p>
                              </div>
                            </div>
                            {schoolAgendaAll.length === 0 ? (
                              <p className="rounded-2xl border border-zinc-800 bg-black/20 py-12 text-center text-zinc-500">
                                אין מבחנים או מטלות פתוחות. הוסף דרך כרטיסי המקצועות למטה.
                              </p>
                            ) : (
                              <ul className="relative space-y-2 before:absolute before:top-2 before:bottom-2 before:w-px before:bg-zinc-800 before:start-4 md:before:start-5">
                                {schoolAgendaAll.map((row) => {
                                  const dateStr =
                                    row.kind === "exam" ? row.exam.date : row.assignment.dueDate;
                                  const label =
                                    row.kind === "exam" ? row.exam.title : row.assignment.title;
                                  const todayKey = isoTodayKey();
                                  const days = Math.round(
                                    (schoolDayTime(dateStr) - schoolDayTime(todayKey)) / 86400000
                                  );
                                  return (
                                    <li
                                      key={`${row.kind}-${row.id}`}
                                      className="relative flex flex-wrap items-start gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/50 py-3 pe-4 ps-12 md:ps-14"
                                    >
                                      <span
                                        className="absolute start-3 top-3 flex h-4 w-4 rounded-full border-2 border-zinc-950 md:start-4"
                                        style={{
                                          backgroundColor:
                                            row.kind === "exam" ? row.subject.color : `${row.subject.color}99`,
                                        }}
                                      />
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span
                                            className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                                              row.kind === "exam"
                                                ? "bg-blue-500/20 text-blue-200"
                                                : "bg-amber-500/15 text-amber-200"
                                            }`}
                                          >
                                            {row.kind === "exam" ? "מבחן" : "מטלה"}
                                          </span>
                                          <span
                                            className="text-xs font-bold"
                                            style={{ color: row.subject.color }}
                                          >
                                            {row.subject.name}
                                          </span>
                                          <span className="text-xs font-bold tabular-nums text-zinc-500">
                                            {new Date(dateStr + "T12:00:00").toLocaleDateString("he-IL", {
                                              weekday: "short",
                                              day: "numeric",
                                              month: "short",
                                            })}
                                          </span>
                                          <span className="text-xs text-zinc-600">
                                            {days === 0
                                              ? "היום"
                                              : days > 0
                                                ? `בעוד ${days} ימים`
                                                : `לפני ${Math.abs(days)} ימים`}
                                          </span>
                                        </div>
                                        <p className="mt-1 font-bold text-white">{label}</p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedSchoolSubjectId(row.subject.id);
                                          setSchoolSubjectTab(row.kind === "exam" ? "exams" : "homework");
                                        }}
                                        className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-bold text-zinc-300 transition-colors hover:border-orange-500/50 hover:text-white"
                                      >
                                        למקצוע
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </section>

                          <div className="hidden lg:block lg:col-span-1" />
                        </div>

                        <section>
                          <h3 className="mb-4 text-xl font-black text-white">המקצועות שלי</h3>
                          {schoolData.subjects.length === 0 ? (
                            <div className="rounded-2xl border border-zinc-800 py-16 text-center text-zinc-500">
                              אין מקצועות — הוסף מקצועות בנתונים או ייבא מחדש.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                              {schoolData.subjects.map((subject) => {
                                const openAssign = schoolData.assignments.filter(
                                  (a) => a.subjectId === subject.id && !a.completed
                                );
                                const upcomingExams = schoolData.exams
                                  .filter((e) => e.subjectId === subject.id && e.status === "upcoming")
                                  .sort((a, b) => schoolDayTime(a.date) - schoolDayTime(b.date));
                                const nextExam = upcomingExams[0];
                                return (
                                  <button
                                    key={subject.id}
                                    type="button"
                                    onClick={() => setSelectedSchoolSubjectId(subject.id)}
                                    className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 text-start transition-all hover:border-orange-500/40 hover:bg-zinc-900"
                                    style={{ borderInlineStartWidth: 4, borderInlineStartColor: subject.color }}
                                  >
                                    <div className="mb-3 flex items-start justify-between gap-2">
                                      <h4 className="text-lg font-black" style={{ color: subject.color }}>
                                        {subject.name}
                                      </h4>
                                      <span className="text-sm font-bold text-white">{subject.progress}%</span>
                                    </div>
                                    <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                                      <div
                                        className="h-full rounded-full transition-all"
                                        style={{
                                          width: `${subject.progress}%`,
                                          backgroundColor: subject.color,
                                        }}
                                      />
                                    </div>
                                    <div className="space-y-1.5 text-xs text-zinc-500">
                                      {openAssign.length > 0 && (
                                        <div className="flex items-center gap-1">
                                          <ClipboardList size={12} className="shrink-0" />
                                          {openAssign.length} מטלות פתוחות
                                        </div>
                                      )}
                                      {nextExam && (
                                        <div className="flex items-center gap-1">
                                          <CalendarDays size={12} className="shrink-0" />
                                          מבחן הבא:{" "}
                                          {new Date(nextExam.date + "T12:00:00").toLocaleDateString("he-IL")}
                                        </div>
                                      )}
                                      {subject.teacher && <div>מורה: {subject.teacher}</div>}
                                    </div>
                                    <div className="mt-4 rounded-xl bg-orange-500/15 py-2 text-center text-sm font-bold text-orange-300">
                                      פתיחת מקצוע
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </section>
                      </div>
                    )}

                    {schoolHubTab === "countdown" && (
                      <div className="space-y-6">
                        <header className="flex flex-wrap items-end justify-between gap-4">
                          <div>
                            <h3 className="text-2xl font-black text-white md:text-3xl">ימים שנשארו עד 20 ביוני</h3>
                            <p className="mt-1 text-sm text-zinc-500">
                              סמן ימים שעברו (בסגנון גיר) והגדר ימים בלי לימודים כדי לקבל נטו אמיתי.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 px-4 py-3">
                              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                                ברוטו
                              </div>
                              <div className="mt-1 text-2xl font-black text-white tabular-nums">
                                {grossDaysLeft}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 px-4 py-3">
                              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                                נטו לימודים
                              </div>
                              <div className="mt-1 text-2xl font-black text-white tabular-nums">
                                {netDaysLeft}
                              </div>
                            </div>
                          </div>
                        </header>

                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                          <div className="lg:col-span-8">
                            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/35 p-6 md:p-8">
                              <SchoolCountdownPanel
                                today={today}
                                endDate={schoolEndDate}
                                value={schoolCountdown}
                                onChange={setSchoolCountdown}
                                grossDaysLeft={grossDaysLeft}
                                netDaysLeft={netDaysLeft}
                              />
                            </div>
                          </div>
                          <div className="lg:col-span-4 space-y-4">
                            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/35 p-6">
                              <div className="text-xs font-black uppercase tracking-widest text-zinc-600">
                                הסבר מהיר
                              </div>
                              <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                                <li>• לחץ על יום (רק עד היום) כדי לסמן “עבר”.</li>
                                <li>• ימי שישי/שבת לא נכנסים לנטו.</li>
                                <li>• הוסף כאן “ימים בלי לימודים” (עצמאות וכו’) כדי להוריד אותם מהנטו.</li>
                              </ul>
                            </div>
                            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/35 p-6">
                              <div className="text-xs font-black uppercase tracking-widest text-zinc-600">
                                טיפ
                              </div>
                              <p className="mt-3 text-sm text-zinc-300">
                                אם אין מקצועות/נתונים עדיין — עבור ל״נושאים והערות״ והפעל את טעינת הדמו, או הוסף מקצועות
                                ואז תתחיל להוסיף מבחנים ושיעורי בית.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {schoolHubTab === "exams" && (
                      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/35 p-6 md:p-8">
                        <h3 className="mb-2 text-xl font-black text-white md:text-2xl">כל המבחנים</h3>
                        <p className="mb-6 text-sm text-zinc-500">לפי תאריך, בכל המקצועות.</p>
                        <div className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950/50 p-5">
                          <h4 className="text-sm font-black text-white">הוסף מבחן</h4>
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
                            <select
                              value={newSchoolHubSubjectId}
                              onChange={(e) => setNewSchoolHubSubjectId(e.target.value)}
                              className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-blue-500"
                            >
                              <option value="">בחר מקצוע</option>
                              {schoolData.subjects.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              placeholder="שם המבחן"
                              value={newExamTitle}
                              onChange={(e) => setNewExamTitle(e.target.value)}
                              className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-blue-500 md:col-span-2"
                            />
                            <input
                              type="date"
                              value={newExamDate}
                              onChange={(e) => setNewExamDate(e.target.value)}
                              className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-blue-500"
                            />
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
                            <input
                              type="text"
                              placeholder="הערות (אופציונלי)"
                              value={newExamNotes}
                              onChange={(e) => setNewExamNotes(e.target.value)}
                              className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-blue-500 md:col-span-3"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (!newSchoolHubSubjectId) return;
                                setSelectedSchoolSubjectId(newSchoolHubSubjectId);
                                addSchoolExam();
                              }}
                              className="rounded-2xl bg-blue-500 px-5 py-3 font-black text-white hover:bg-blue-600 transition-colors"
                            >
                              הוסף
                            </button>
                          </div>
                          {schoolData.subjects.length === 0 && (
                            <p className="mt-3 text-xs text-zinc-500">
                              קודם הוסף מקצועות, ואז תוכל להוסיף מבחנים.
                            </p>
                          )}
                        </div>
                        {schoolData.exams.filter((e) => e.status === "upcoming").length === 0 ? (
                          <p className="py-12 text-center text-zinc-500">אין מבחנים קרובים</p>
                        ) : (
                          <ul className="space-y-2">
                            {schoolData.exams
                              .filter((e) => e.status === "upcoming")
                              .sort((a, b) => schoolDayTime(a.date) - schoolDayTime(b.date))
                              .map((exam) => {
                                const sub = schoolData.subjects.find((s) => s.id === exam.subjectId);
                                const todayKey = new Date().toISOString().split("T")[0];
                                const days = Math.round(
                                  (schoolDayTime(exam.date) - schoolDayTime(todayKey)) / 86400000
                                );
                                return (
                                  <li
                                    key={exam.id}
                                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-500/20 bg-blue-950/15 px-4 py-3"
                                  >
                                    <div className="min-w-0">
                                      <div className="font-bold text-white">{exam.title}</div>
                                      <div className="mt-0.5 text-xs text-zinc-500">
                                        <span style={{ color: sub?.color }} className="font-bold">
                                          {sub?.name ?? "מקצוע"}
                                        </span>
                                        {" • "}
                                        {new Date(exam.date + "T12:00:00").toLocaleDateString("he-IL", {
                                          weekday: "long",
                                          day: "numeric",
                                          month: "long",
                                          year: "numeric",
                                        })}
                                        {" • "}
                                        {days === 0
                                          ? "היום"
                                          : days > 0
                                            ? `בעוד ${days} ימים`
                                            : `לפני ${Math.abs(days)} ימים`}
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 gap-2">
                                      {sub && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedSchoolSubjectId(sub.id);
                                            setSchoolSubjectTab("exams");
                                          }}
                                          className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-bold text-zinc-300 hover:border-orange-500/50 hover:text-white"
                                        >
                                          למקצוע
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSchoolData((prev) => ({
                                            ...prev,
                                            exams: prev.exams.filter((e) => e.id !== exam.id),
                                          }));
                                        }}
                                        className="rounded-lg p-2 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  </li>
                                );
                              })}
                          </ul>
                        )}
                      </section>
                    )}

                    {schoolHubTab === "homework" && (
                      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/35 p-6 md:p-8">
                        <h3 className="mb-2 text-xl font-black text-white md:text-2xl">כל שיעורי הבית</h3>
                        <p className="mb-6 text-sm text-zinc-500">מטלות שלא סומנו כהושלמו, לפי תאריך יעד.</p>
                        <div className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950/50 p-5">
                          <h4 className="text-sm font-black text-white">הוסף שיעורי בית</h4>
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
                            <select
                              value={newSchoolHubSubjectId}
                              onChange={(e) => setNewSchoolHubSubjectId(e.target.value)}
                              className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-blue-500"
                            >
                              <option value="">בחר מקצוע</option>
                              {schoolData.subjects.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              placeholder="שם המטלה"
                              value={newAssignmentTitle}
                              onChange={(e) => setNewAssignmentTitle(e.target.value)}
                              className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-blue-500 md:col-span-2"
                            />
                            <input
                              type="date"
                              value={newAssignmentDue}
                              onChange={(e) => setNewAssignmentDue(e.target.value)}
                              className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-blue-500"
                            />
                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
                            <select
                              value={newAssignmentType}
                              onChange={(e) =>
                                setNewAssignmentType(e.target.value as SchoolAssignment["type"])
                              }
                              className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-blue-500"
                            >
                              <option value="homework">שיעורי בית</option>
                              <option value="reading">קריאה</option>
                              <option value="worksheet">דף עבודה</option>
                              <option value="project">פרויקט</option>
                              <option value="study">לימוד</option>
                            </select>
                            <select
                              value={newAssignmentPriority}
                              onChange={(e) =>
                                setNewAssignmentPriority(e.target.value as "low" | "medium" | "high")
                              }
                              className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-blue-500"
                            >
                              <option value="low">עדיפות נמוכה</option>
                              <option value="medium">עדיפות בינונית</option>
                              <option value="high">עדיפות גבוהה</option>
                            </select>
                            <div className="md:col-span-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (!newSchoolHubSubjectId) return;
                                  setSelectedSchoolSubjectId(newSchoolHubSubjectId);
                                  addSchoolAssignment();
                                }}
                                className="w-full rounded-2xl bg-blue-500 px-5 py-3 font-black text-white hover:bg-blue-600 transition-colors"
                              >
                                הוסף
                              </button>
                            </div>
                          </div>

                          {schoolData.subjects.length === 0 && (
                            <p className="mt-3 text-xs text-zinc-500">
                              קודם הוסף מקצועות, ואז תוכל להוסיף שיעורי בית.
                            </p>
                          )}
                        </div>
                        {schoolData.assignments.filter((a) => !a.completed).length === 0 ? (
                          <p className="py-12 text-center text-zinc-500">אין מטלות פתוחות</p>
                        ) : (
                          <ul className="space-y-2">
                            {schoolData.assignments
                              .filter((a) => !a.completed)
                              .sort((a, b) => schoolDayTime(a.dueDate) - schoolDayTime(b.dueDate))
                              .map((a) => {
                                const sub = schoolData.subjects.find((s) => s.id === a.subjectId);
                                return (
                                  <li
                                    key={a.id}
                                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/15 bg-amber-950/10 px-4 py-3"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="font-bold text-white">{a.title}</div>
                                      <div className="mt-0.5 text-xs text-zinc-500">
                                        <span style={{ color: sub?.color }} className="font-bold">
                                          {sub?.name ?? "מקצוע"}
                                        </span>
                                        {" • "}
                                        {new Date(a.dueDate + "T12:00:00").toLocaleDateString("he-IL")}
                                        {" • "}
                                        {SCHOOL_ASSIGNMENT_TYPE_HE[a.type]}
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={a.completed}
                                        onChange={() => {
                                          setSchoolData((prev) => ({
                                            ...prev,
                                            assignments: prev.assignments.map((x) =>
                                              x.id === a.id ? { ...x, completed: !x.completed } : x
                                            ),
                                          }));
                                        }}
                                        className="h-5 w-5 cursor-pointer rounded"
                                        title="סמן כהושלם"
                                      />
                                      {sub && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedSchoolSubjectId(sub.id);
                                            setSchoolSubjectTab("homework");
                                          }}
                                          className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-bold text-zinc-300 hover:border-orange-500/50 hover:text-white"
                                        >
                                          למקצוע
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSchoolData((prev) => ({
                                            ...prev,
                                            assignments: prev.assignments.filter((x) => x.id !== a.id),
                                          }));
                                        }}
                                        className="rounded-lg p-2 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  </li>
                                );
                              })}
                          </ul>
                        )}
                      </section>
                    )}

                    {schoolHubTab === "topics" && (
                      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/35 p-6 md:p-8">
                        <h3 className="mb-2 text-xl font-black text-white md:text-2xl">נושאים והערות</h3>
                        <p className="mb-6 text-sm text-zinc-500">
                          כל מה שנשמר במקצועות — מקובץ לפי מקצוע (חומר לימוד, נושאים).
                        </p>
                        {schoolData.notes.length === 0 ? (
                          <p className="py-12 text-center text-zinc-500">אין הערות. הוסף מתוך כרטיס מקצוע.</p>
                        ) : (
                          <div className="space-y-8">
                            {schoolData.subjects.map((sub) => {
                              const notes = schoolData.notes.filter((n) => n.subjectId === sub.id);
                              if (notes.length === 0) return null;
                              return (
                                <div key={sub.id}>
                                  <h4
                                    className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide"
                                    style={{ color: sub.color }}
                                  >
                                    <BookMarked size={16} />
                                    {sub.name}
                                  </h4>
                                  <ul className="space-y-2">
                                    {notes.map((note) => (
                                      <li
                                        key={note.id}
                                        className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4"
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="min-w-0">
                                            <div className="font-bold text-white">{note.title}</div>
                                            <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-400">
                                              {note.content}
                                            </p>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSchoolData((prev) => ({
                                                ...prev,
                                                notes: prev.notes.filter((n) => n.id !== note.id),
                                              }));
                                            }}
                                            className="shrink-0 text-zinc-500 hover:text-red-400"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
    
    
  );
}