"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  School,
  GraduationCap,
  Target,
  Calendar,
  ChevronDown,
  ChevronUp,
  Trophy,
  Flame,
  AlertTriangle,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

type GoalCategory = "school" | "university" | "personal";
type GoalImportance = "low" | "medium" | "high";
type GoalStatus = "not-started" | "in-progress" | "completed";

type GoalStep = { id: string; text: string; done: boolean };

type Goal = {
  id: string;
  category: GoalCategory;
  title: string;
  description: string;
  deadline: string;
  importance: GoalImportance;
  status: GoalStatus;
  steps: GoalStep[];
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function computeProgress(steps: GoalStep[]): number {
  if (steps.length === 0) return 0;
  return Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
}

function daysUntilDeadline(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / 86400000);
}

function fmtDeadline(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Persistence ───────────────────────────────────────────────────────────────

const GOALS_USER_ID = "ronen-local-001-goals";

async function saveGoalsData(goals: Goal[]) {
  const { error } = await supabase
    .from("profiles_data1")
    .upsert(
      { user_id: GOALS_USER_ID, data: { goals } },
      { onConflict: "user_id" }
    );
  if (error) console.error("Goals save error:", error);
}

async function loadGoalsData(): Promise<Goal[] | null> {
  const { data, error } = await supabase
    .from("profiles_data1")
    .select("data")
    .eq("user_id", GOALS_USER_ID)
    .maybeSingle();
  if (error) {
    console.error("Goals load error:", error);
    return null;
  }
  return (data?.data as { goals: Goal[] })?.goals ?? null;
}

// ─── Config ────────────────────────────────────────────────────────────────────

const CATS = {
  school: {
    label: "בית ספר",
    Icon: School,
    progressBar: "bg-sky-500",
    tabActive: "border-sky-500 text-sky-400",
    countBadgeActive: "bg-sky-500/20 text-sky-300",
    emptyIconCls: "text-sky-800",
    headerAccent: "text-sky-400",
  },
  university: {
    label: "אוניברסיטה",
    Icon: GraduationCap,
    progressBar: "bg-violet-500",
    tabActive: "border-violet-500 text-violet-400",
    countBadgeActive: "bg-violet-500/20 text-violet-300",
    emptyIconCls: "text-violet-800",
    headerAccent: "text-violet-400",
  },
  personal: {
    label: "מטרות אישיות",
    Icon: Target,
    progressBar: "bg-emerald-500",
    tabActive: "border-emerald-500 text-emerald-400",
    countBadgeActive: "bg-emerald-500/20 text-emerald-300",
    emptyIconCls: "text-emerald-800",
    headerAccent: "text-emerald-400",
  },
} as const;

const IMPORTANCE_META: Record<
  GoalImportance,
  { label: string; cls: string; dot: string }
> = {
  high: {
    label: "חשיבות גבוהה",
    cls: "bg-red-500/10 text-red-300 border border-red-500/25",
    dot: "bg-red-400",
  },
  medium: {
    label: "חשיבות בינונית",
    cls: "bg-amber-500/10 text-amber-300 border border-amber-500/25",
    dot: "bg-amber-400",
  },
  low: {
    label: "חשיבות נמוכה",
    cls: "bg-zinc-700/30 text-zinc-400 border border-zinc-600/30",
    dot: "bg-zinc-500",
  },
};

const STATUS_META: Record<GoalStatus, { label: string; cls: string }> = {
  "not-started": {
    label: "לא התחיל",
    cls: "bg-zinc-700/30 text-zinc-400 border border-zinc-600/30",
  },
  "in-progress": {
    label: "בתהליך",
    cls: "bg-blue-500/10 text-blue-300 border border-blue-500/25",
  },
  completed: {
    label: "הושלם ✓",
    cls: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/25",
  },
};

// ─── GoalModal ─────────────────────────────────────────────────────────────────

function GoalModal({
  initial,
  defaultCategory,
  onSave,
  onClose,
}: {
  initial: Goal | null;
  defaultCategory: GoalCategory;
  onSave: (g: Goal) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [deadline, setDeadline] = useState(initial?.deadline ?? "");
  const [category, setCategory] = useState<GoalCategory>(
    initial?.category ?? defaultCategory
  );
  const [importance, setImportance] = useState<GoalImportance>(
    initial?.importance ?? "medium"
  );
  const [status, setStatus] = useState<GoalStatus>(
    initial?.status ?? "not-started"
  );
  const [steps, setSteps] = useState<GoalStep[]>(initial?.steps ?? []);
  const [newStep, setNewStep] = useState("");

  function addStep() {
    const t = newStep.trim();
    if (!t) return;
    setSteps((prev) => [...prev, { id: genId(), text: t, done: false }]);
    setNewStep("");
  }

  function removeStep(id: string) {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  }

  function toggleStep(id: string) {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s))
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !deadline) return;
    onSave({
      id: initial?.id ?? genId(),
      category,
      title: title.trim(),
      description: description.trim(),
      deadline,
      importance,
      status,
      steps,
    });
  }

  const inputCls =
    "w-full bg-zinc-900 border border-zinc-700/60 rounded-xl px-4 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors";
  const labelCls = "block text-[11px] font-black text-zinc-400 uppercase tracking-wider mb-1.5";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-zinc-950 flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 z-10">
          <h2 className="text-base font-black text-white">
            {initial ? "עריכת מטרה" : "מטרה חדשה"}
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-zinc-800"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Category */}
          <div>
            <label className={labelCls}>קטגוריה</label>
            <div className="grid grid-cols-3 gap-2">
              {(["school", "university", "personal"] as GoalCategory[]).map(
                (c) => {
                  const cc = CATS[c];
                  const isActive = category === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-bold border transition-all ${
                        isActive
                          ? `bg-zinc-800 border-zinc-600 text-white`
                          : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                      }`}
                    >
                      <cc.Icon size={16} />
                      {cc.label}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className={labelCls}>כותרת המטרה *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputCls}
              placeholder="למה אתה שואף?"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>תיאור קצר</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputCls + " resize-none"}
              rows={2}
              placeholder="פרט את המטרה..."
            />
          </div>

          {/* Deadline */}
          <div>
            <label className={labelCls}>תאריך יעד *</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className={inputCls}
              required
            />
          </div>

          {/* Importance + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>חשיבות</label>
              <select
                value={importance}
                onChange={(e) =>
                  setImportance(e.target.value as GoalImportance)
                }
                className={inputCls}
              >
                <option value="high">גבוהה</option>
                <option value="medium">בינונית</option>
                <option value="low">נמוכה</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>סטטוס</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as GoalStatus)}
                className={inputCls}
              >
                <option value="not-started">לא התחיל</option>
                <option value="in-progress">בתהליך</option>
                <option value="completed">הושלם</option>
              </select>
            </div>
          </div>

          {/* Steps */}
          <div>
            <label className={labelCls}>
              צעדים קטנים
              {steps.length > 0 && (
                <span className="ml-1.5 font-bold text-zinc-500 normal-case">
                  ({steps.filter((s) => s.done).length}/{steps.length} הושלמו)
                </span>
              )}
            </label>
            <div className="space-y-2 mb-2">
              {steps.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2.5 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2"
                >
                  <button
                    type="button"
                    onClick={() => toggleStep(s.id)}
                    className="shrink-0 transition-colors"
                  >
                    {s.done ? (
                      <CheckCircle2 size={16} className="text-emerald-400" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-zinc-600 hover:border-zinc-400 transition-colors" />
                    )}
                  </button>
                  <span
                    className={`flex-1 text-sm ${
                      s.done ? "line-through text-zinc-600" : "text-zinc-200"
                    }`}
                  >
                    {s.text}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeStep(s.id)}
                    className="text-zinc-600 hover:text-red-400 transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newStep}
                onChange={(e) => setNewStep(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addStep();
                  }
                }}
                className={inputCls}
                placeholder="הוסף צעד... (Enter לאישור)"
              />
              <button
                type="button"
                onClick={addStep}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-300 hover:text-white transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1 pb-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm font-bold hover:bg-zinc-900 hover:text-zinc-200 transition-colors"
            >
              ביטול
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-white text-black text-sm font-black hover:bg-zinc-100 transition-colors"
            >
              שמור מטרה
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── GoalCard ──────────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  progressBarCls,
  onEdit,
  onDelete,
  onToggleComplete,
  onToggleStep,
}: {
  goal: Goal;
  progressBarCls: string;
  onEdit: () => void;
  onDelete: () => void;
  onToggleComplete: () => void;
  onToggleStep: (stepId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const progress = computeProgress(goal.steps);
  const days = daysUntilDeadline(goal.deadline);
  const isCompleted = goal.status === "completed";
  const imp = IMPORTANCE_META[goal.importance];
  const stat = STATUS_META[goal.status];

  const deadlineColor = isCompleted
    ? "text-emerald-400"
    : days < 0
    ? "text-red-400"
    : days <= 3
    ? "text-red-400"
    : days <= 7
    ? "text-orange-400"
    : days <= 14
    ? "text-amber-400"
    : "text-zinc-500";

  const deadlineLabel = isCompleted
    ? "הושלמה"
    : days < 0
    ? `פג לפני ${Math.abs(days)} ימים`
    : days === 0
    ? "היום!"
    : days === 1
    ? "מחר"
    : `עוד ${days} ימים`;

  return (
    <div
      className={`group relative bg-zinc-900/80 border rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-black/20 ${
        isCompleted
          ? "border-zinc-800 opacity-65"
          : goal.importance === "high"
          ? "border-zinc-700 shadow-sm shadow-red-950/20"
          : "border-zinc-800 hover:border-zinc-700"
      }`}
    >
      {/* High importance accent */}
      {goal.importance === "high" && !isCompleted && (
        <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-red-500/60 rounded-r-2xl" />
      )}

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <button
            onClick={onToggleComplete}
            className="mt-0.5 shrink-0 transition-all hover:scale-110"
            title={isCompleted ? "בטל סימון" : "סמן כהושלם"}
          >
            {isCompleted ? (
              <CheckCircle2 size={20} className="text-emerald-400" />
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-zinc-600 group-hover:border-zinc-400 transition-colors" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <h3
              className={`font-bold text-sm leading-snug ${
                isCompleted
                  ? "line-through text-zinc-600"
                  : "text-white"
              }`}
            >
              {goal.title}
            </h3>
            {goal.description && (
              <p className="mt-1 text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                {goal.description}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-zinc-300 transition-colors"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-red-400 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Badges */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${imp.cls}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${imp.dot}`} />
            {imp.label}
          </span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stat.cls}`}
          >
            {stat.label}
          </span>
        </div>

        {/* Progress bar */}
        {goal.steps.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wide">
                התקדמות
              </span>
              <span
                className={`text-[11px] font-black tabular-nums ${
                  progress === 100 ? "text-emerald-400" : "text-zinc-300"
                }`}
              >
                {progress}%
              </span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${progressBarCls} rounded-full transition-all duration-500`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <div
            className={`flex items-center gap-1 text-[11px] font-bold ${deadlineColor}`}
            title={fmtDeadline(goal.deadline)}
          >
            {!isCompleted && days <= 3 && days >= 0 ? (
              <AlertTriangle size={11} />
            ) : (
              <Calendar size={11} />
            )}
            <span>{deadlineLabel}</span>
          </div>

          {goal.steps.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors font-bold"
            >
              {goal.steps.filter((s) => s.done).length}/{goal.steps.length}{" "}
              צעדים
              {expanded ? (
                <ChevronUp size={12} />
              ) : (
                <ChevronDown size={12} />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Expanded steps */}
      {expanded && goal.steps.length > 0 && (
        <div className="border-t border-zinc-800/70 px-5 py-3 space-y-1 bg-zinc-950/40">
          {goal.steps.map((s) => (
            <button
              key={s.id}
              onClick={() => onToggleStep(s.id)}
              className="w-full flex items-center gap-2.5 text-right hover:bg-zinc-800/50 px-2 py-1.5 rounded-lg transition-colors"
            >
              {s.done ? (
                <CheckCircle2
                  size={14}
                  className="text-emerald-400 shrink-0"
                />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-zinc-600 shrink-0" />
              )}
              <span
                className={`text-xs flex-1 text-right ${
                  s.done ? "line-through text-zinc-600" : "text-zinc-300"
                }`}
              >
                {s.text}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stats Bar ─────────────────────────────────────────────────────────────────

function StatsBar({
  goals,
  progressBarCls,
}: {
  goals: Goal[];
  progressBarCls: string;
}) {
  const total = goals.length;
  const completed = goals.filter((g) => g.status === "completed").length;
  const inProgress = goals.filter((g) => g.status === "in-progress").length;
  const urgent = goals.filter(
    (g) =>
      g.status !== "completed" &&
      g.deadline &&
      daysUntilDeadline(g.deadline) <= 7
  ).length;

  if (total === 0) return null;

  const pct = Math.round((completed / total) * 100);

  return (
    <div className="mb-6 flex flex-wrap items-center gap-4 sm:gap-6">
      <div className="flex items-center gap-3">
        <div className="h-1.5 w-28 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full ${progressBarCls} rounded-full transition-all duration-700`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-zinc-400 font-bold tabular-nums">
          {completed}/{total} הושלמו
        </span>
      </div>
      {inProgress > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-blue-400 font-bold">
          <Flame size={12} />
          {inProgress} בתהליך
        </div>
      )}
      {urgent > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-red-400 font-bold">
          <AlertTriangle size={12} />
          {urgent} דחוף
        </div>
      )}
      {completed === total && total > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
          <Trophy size={12} />
          כל המטרות הושלמו!
        </div>
      )}
    </div>
  );
}

// ─── GoalsPage ─────────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<GoalCategory>("school");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Load from Supabase
  useEffect(() => {
    let alive = true;
    loadGoalsData().then((saved) => {
      if (!alive) return;
      if (saved) setGoals(saved);
      setHasLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Save to Supabase
  useEffect(() => {
    if (!hasLoaded) return;
    saveGoalsData(goals);
  }, [hasLoaded, goals]);

  const byCategory = useMemo(
    () => ({
      school: goals.filter((g) => g.category === "school"),
      university: goals.filter((g) => g.category === "university"),
      personal: goals.filter((g) => g.category === "personal"),
    }),
    [goals]
  );

  const activeGoals = byCategory[activeTab];
  const cat = CATS[activeTab];

  function saveGoal(g: Goal) {
    setGoals((prev) => {
      const idx = prev.findIndex((x) => x.id === g.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = g;
        return next;
      }
      return [...prev, g];
    });
    setModalOpen(false);
    setEditingGoal(null);
  }

  function deleteGoal(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    setDeleteId(null);
  }

  function toggleComplete(id: string) {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        const newStatus: GoalStatus =
          g.status === "completed" ? "in-progress" : "completed";
        return { ...g, status: newStatus };
      })
    );
  }

  function toggleStep(goalId: string, stepId: string) {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;
        const updatedSteps = g.steps.map((s) =>
          s.id === stepId ? { ...s, done: !s.done } : s
        );
        const allDone = updatedSteps.length > 0 && updatedSteps.every((s) => s.done);
        return {
          ...g,
          steps: updatedSteps,
          status: allDone ? "completed" : g.status === "completed" ? "in-progress" : g.status,
        };
      })
    );
  }

  const sortedActiveGoals = useMemo(() => {
    const impOrder: Record<GoalImportance, number> = { high: 0, medium: 1, low: 2 };
    return [...activeGoals].sort((a, b) => {
      if (a.status === "completed" && b.status !== "completed") return 1;
      if (b.status === "completed" && a.status !== "completed") return -1;
      return impOrder[a.importance] - impOrder[b.importance];
    });
  }, [activeGoals]);

  function openAdd() {
    setEditingGoal(null);
    setModalOpen(true);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white" dir="rtl">
      {/* Sticky header */}
      <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3 sm:gap-4">
          <Link
            href="/"
            className="text-zinc-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-zinc-900 shrink-0"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-white">
              המטרות שלי
            </h1>
            <p className="text-[11px] text-zinc-500 font-medium">
              {goals.length} מטרות סה&quot;כ ·{" "}
              {goals.filter((g) => g.status === "completed").length} הושלמו
            </p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 bg-white text-black px-3 sm:px-4 py-2 rounded-xl text-sm font-black hover:bg-zinc-100 transition-colors shrink-0"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">הוסף מטרה</span>
            <span className="sm:hidden">הוסף</span>
          </button>
        </div>

        {/* Category tabs */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex">
            {(["school", "university", "personal"] as GoalCategory[]).map(
              (tab) => {
                const tc = CATS[tab];
                const count = byCategory[tab].length;
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
                      isActive
                        ? tc.tabActive
                        : "border-transparent text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <tc.Icon size={14} />
                    <span className="hidden xs:inline sm:inline">
                      {tc.label}
                    </span>
                    <span className="xs:hidden sm:hidden">
                      {tab === "school"
                        ? "בי\"ס"
                        : tab === "university"
                        ? "אוני'"
                        : "אישי"}
                    </span>
                    {count > 0 && (
                      <span
                        className={`text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                          isActive
                            ? tc.countBadgeActive
                            : "bg-zinc-800 text-zinc-500"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              }
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <StatsBar goals={activeGoals} progressBarCls={cat.progressBar} />

        {sortedActiveGoals.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-5">
              <cat.Icon size={36} className={cat.emptyIconCls} />
            </div>
            <p className="text-zinc-400 font-black text-lg mb-1">
              אין מטרות עדיין
            </p>
            <p className="text-zinc-600 text-sm mb-7">
              הוסף את המטרה הראשונה שלך ב{cat.label}
            </p>
            <button
              onClick={openAdd}
              className={`inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors ${cat.headerAccent}`}
            >
              <Plus size={15} />
              הוסף מטרה
            </button>
          </div>
        ) : (
          /* Goals grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedActiveGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                progressBarCls={cat.progressBar}
                onEdit={() => {
                  setEditingGoal(goal);
                  setModalOpen(true);
                }}
                onDelete={() => setDeleteId(goal.id)}
                onToggleComplete={() => toggleComplete(goal.id)}
                onToggleStep={(stepId) => toggleStep(goal.id, stepId)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Add/Edit modal */}
      {modalOpen && (
        <GoalModal
          initial={editingGoal}
          defaultCategory={activeTab}
          onSave={saveGoal}
          onClose={() => {
            setModalOpen(false);
            setEditingGoal(null);
          }}
        />
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
              <Trash2 size={20} className="text-red-400" />
            </div>
            <h3 className="text-base font-black text-white mb-1.5">
              מחיקת מטרה
            </h3>
            <p className="text-sm text-zinc-500 mb-6 leading-relaxed">
              האם אתה בטוח שברצונך למחוק את המטרה הזו? פעולה זו לא ניתנת
              לביטול.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm font-bold hover:bg-zinc-900 hover:text-zinc-200 transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={() => deleteGoal(deleteId)}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-black hover:bg-red-600 transition-colors"
              >
                מחק
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
