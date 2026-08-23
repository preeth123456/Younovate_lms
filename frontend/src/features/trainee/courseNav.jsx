// src/features/trainee/courseNav.jsx
//
// Shared helpers for the trainee drill-down pages:
//   CourseSegment (Month) → CourseTopic (Subject) → LessonPlayer (Session)
//
// URL mapping:
//   :courseId  → Course _id
//   :segmentId → Month   _id   (a "module")
//   :topicId   → Subject _id
//   :lessonId  → session key: 's1' | 's2' | 's3' | 's4'

import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import { API_BASE_URL } from "../../config/api";

export const API = API_BASE_URL;

// If you mount these routes somewhere other than /trainee/coursess, change this once.
export const TRAINEE_BASE = "/trainee/coursess";
export const urls = {
  course:  (c) => `${TRAINEE_BASE}/${c}`,
  segment: (c, s) => `${TRAINEE_BASE}/${c}/segment/${s}`,
  topic:   (c, s, t) => `${TRAINEE_BASE}/${c}/segment/${s}/${t}`,
  lesson:  (c, s, t, l) => `${TRAINEE_BASE}/${c}/segment/${s}/${t}/${l}`,
};

export const COLORS = { INK: "#16202b", MUTED: "#98a2b3", NAVY: "#37404c", GREEN: "#16a37b", PAGE: "#f3f4f6" };

export const SESSION_DEFS = [
  { key: "s1", tag: "S1", label: "Theory",           hk: "s1Theory",     field: "theoryContent",     list: true },
  { key: "s2", tag: "S2", label: "Practical",        hk: "s2Practical",  field: "practicalActivity", list: true },
  { key: "s3", tag: "S3", label: "Assignment",       hk: "s3Assignment", field: "assignmentTask",    list: false },
  { key: "s4", tag: "S4", label: "Feedback / Score", hk: "s4Feedback",   field: null,                list: false },
];

export const hrs = (n) => `${Number(n) || 0}h`;
export const norm = (s) => (s || "").toString().trim().toLowerCase();
export const splitItems = (t) => (t || "").split(/\r?\n|,|·|;/).map((x) => x.trim()).filter(Boolean);

export const sessionHours = (subject, def) => Number(subject?.hours?.[def.hk]) || 0;
export const sessionContent = (content, def) => (def.field ? content?.[def.field] || "" : "");
export const sessionHasStuff = (subject, content, def) =>
  sessionHours(subject, def) > 0 || !!sessionContent(content, def);
export const availableSessions = (subject, content) =>
  SESSION_DEFS.filter((d) => sessionHasStuff(subject, content, d));

// ── progress (hours-weighted from subject.status) ───────────────────────────
export const subjectHours = (s) => {
  const h = s?.hours || {};
  if (h.total != null) return Number(h.total) || 0;
  return ["s1Theory", "s2Practical", "s3Assignment", "s4Feedback"].reduce((a, k) => a + (Number(h[k]) || 0), 0);
};
export const subjectFraction = (s) => {
  const st = norm(s?.status);
  return st === "completed" ? 1 : st === "in progress" ? 0.5 : 0;
};
export const rollup = (subjects = []) => {
  let total = 0, done = 0;
  subjects.forEach((s) => { const h = subjectHours(s); total += h; done += h * subjectFraction(s); });
  return { total, count: subjects.length, pct: total ? Math.round((done / total) * 100) : 0 };
};
export const statusFromPct = (p) => (p >= 100 ? "completed" : p > 0 ? "current" : "todo");
export const subjectStatusKey = (s) =>
  norm(s?.status) === "completed" ? "completed" : norm(s?.status) === "in progress" ? "current" : "todo";

// ── tree lookups ─────────────────────────────────────────────────────────────
export const findMonth = (course, monthId) => {
  for (const t of course?.trimesters || [])
    for (const m of t.months || [])
      if (String(m._id) === String(monthId)) return { trimester: t, month: m };
  return {};
};
export const findSubject = (course, monthId, subjectId) => {
  const { trimester, month } = findMonth(course, monthId);
  if (!month) return {};
  const subject = (month.subjects || []).find((s) => String(s._id) === String(subjectId));
  return { trimester, month, subject };
};

// ── content fetch (per subject; 404 = not backfilled yet → null) ────────────
export const useSubjectContent = (courseId, subjectId) => {
  const token = useSelector((s) => s.auth?.token);
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!courseId || !subjectId) return;
    let alive = true;
    setLoading(true);
    axios
      .get(`${API}/api/courses/${courseId}/subjects/${subjectId}/content`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((r) => alive && setContent(r.data?.data || null))
      .catch(() => alive && setContent(null))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [courseId, subjectId, token]);
  return { content, loading };
};

// ── icons ─────────────────────────────────────────────────────────────────────
export const Check = ({ s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <path d="M20 6L9 17l-5-5" stroke={COLORS.GREEN} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const PlayC = ({ s = 22 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="11" fill={COLORS.GREEN} /><path d="M10 8.5l6 3.5-6 3.5z" fill="#fff" />
  </svg>
);
export const EmptyC = ({ s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#cbd2da" strokeWidth="1.8" /></svg>
);
export const StatusGlyph = ({ status, size }) =>
  status === "completed" ? <Check s={size} /> : status === "current" ? <PlayC s={size} /> : <EmptyC s={size} />;

export const navCss = `
  .cn-card{transition:box-shadow .18s ease,border-color .18s ease;}
  .cn-card:hover{box-shadow:0 6px 20px rgba(16,24,40,.10);}
  .cn-row{transition:background .15s ease;cursor:pointer;}
  .cn-row:hover{background:#f7f8fa;}
  .cn-fill{transition:width .6s cubic-bezier(.4,0,.2,1);}
`;