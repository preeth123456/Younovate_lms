// src/features/trainee/Trainee_Courses.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import axios from "axios";
import { API_BASE_URL } from "../../config/api";

/* ──────────────────────────────────────────────────────────────────────────
   NOTE ON PROGRESS
   Your course schema is { _id, name, code, level, status, duration, modules[] }
   — it has no per-trainee progress field. The upGrad UI shows a completion %,
   which normally lives on the *enrollment* record, not the course.
   GET /api/trainee/courses joins that progress (Enrollment.progressPercent)
   onto each enrolled course; this card falls back to 0 when absent.
   ────────────────────────────────────────────────────────────────────────── */

const getProgress = (course) => {
  const raw =
    course?.progress ??
    course?.completionPercentage ??
    course?.completion ??
    0;
  return Math.max(0, Math.min(100, Math.round(Number(raw) || 0)));
};

const Trainee_Courses = () => {
  // My Courses = ONLY this trainee's enrolled courses.
  // Uses GET /api/trainee/courses (authenticated trainee, server-filtered) —
  // NEVER the all-courses list. Shared admin courseSlice state is untouched.
  const token = useSelector((s) => s.auth?.token);
  const [courses, setCourses] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  const load = async () => {
    setStatus("loading");
    setError(null);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/trainee/courses`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setCourses(Array.isArray(data?.courses) ? data.courses : []);
      setStatus("succeeded");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong.");
      setStatus("failed");
    }
  };

  useEffect(() => {
    if (status === "idle") load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // inside the component:
const navigate = useNavigate();

  return (
    <div style={styles.page}>
      <style>{css}</style>

      <div style={styles.wrap}>
        <h1 style={styles.heading}>My Courses</h1>

        {status === "loading" && (
          <div style={styles.stack}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="tc-card tc-skeleton" style={styles.card}>
                <div className="tc-skel-line" style={{ width: "55%", height: 18 }} />
                <div style={{ height: 20 }} />
                <div className="tc-skel-line" style={{ width: "30%", height: 12 }} />
                <div className="tc-skel-line" style={{ width: "100%", height: 8, marginTop: 14, borderRadius: 999 }} />
              </div>
            ))}
          </div>
        )}

        {status === "failed" && (
          <div style={styles.state}>
            <p style={styles.stateTitle}>Couldn’t load your courses</p>
            <p style={styles.stateSub}>{error || "Something went wrong."}</p>
            <button
              style={styles.retryBtn}
              onClick={load}
            >
              Retry
            </button>
          </div>
        )}

        {status === "succeeded" && courses.length === 0 && (
          <div style={styles.state}>
            <p style={styles.stateTitle}>No courses yet</p>
            <p style={styles.stateSub}>You’re not enrolled in any courses right now.</p>
          </div>
        )}

        {status === "succeeded" && courses.length > 0 && (
          <div style={styles.stack}>
            {courses.map((course) => {
              const progress = getProgress(course);
              return (
                <div className="tc-card" 
                style={styles.card} key={course._id}
                onClick={() => navigate(`/trainee/coursess/${course._id}`)}
                >
                  <div style={styles.cardTop}>
                    <h2 style={styles.title}>{course.name}</h2>
                    {course.code && <span style={styles.code}>{course.code}</span>}
                  </div>

                  <div style={styles.progressRow}>
                    <span style={styles.progressLabel}>Course Progress</span>
                    <span style={styles.progressPct}>{progress}%</span>
                  </div>

                  <div style={styles.track}>
                    <div
                      className="tc-fill"
                      style={{ ...styles.fill, width: `${progress}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/* ── styles ─────────────────────────────────────────────────────────────── */

const NAVY = "#37404c";
const INK = "#1f2733";
const MUTED = "#9aa3af";
const TRACK = "#e7eaee";

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f3f4f6",
    fontFamily:
      '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    padding: "32px 16px",
    boxSizing: "border-box",
  },
  wrap: { maxWidth: 560, margin: "0 auto" },
  heading: {
    fontSize: 22,
    fontWeight: 700,
    color: INK,
    margin: "0 0 24px",
  },
  stack: { display: "flex", flexDirection: "column", gap: 24 },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: "26px 30px",
    boxShadow: "0 1px 3px rgba(16, 24, 40, 0.06)",
  },
  cardTop: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  title: { fontSize: 19, fontWeight: 600, color: INK, margin: 0, lineHeight: 1.3 },
  code: { fontSize: 12, fontWeight: 600, color: MUTED, whiteSpace: "nowrap" },
  progressRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 10,
  },
  progressLabel: { fontSize: 15, color: MUTED, fontWeight: 400 },
  progressPct: { fontSize: 15, color: INK, fontWeight: 600 },
  track: {
    height: 7,
    background: TRACK,
    borderRadius: 999,
    overflow: "hidden",
  },
  fill: { height: "100%", background: NAVY, borderRadius: 999 },
  state: {
    background: "#fff",
    borderRadius: 12,
    padding: "40px 30px",
    textAlign: "center",
    boxShadow: "0 1px 3px rgba(16, 24, 40, 0.06)",
  },
  stateTitle: { fontSize: 17, fontWeight: 600, color: INK, margin: "0 0 6px" },
  stateSub: { fontSize: 14, color: MUTED, margin: "0 0 18px" },
  retryBtn: {
    border: "none",
    background: NAVY,
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    padding: "9px 22px",
    borderRadius: 8,
    cursor: "pointer",
  },
};

const css = `
  .tc-card { transition: box-shadow .18s ease, transform .18s ease; }
  .tc-card:hover { box-shadow: 0 6px 18px rgba(16,24,40,.10); transform: translateY(-1px); }
  .tc-fill { transition: width .5s cubic-bezier(.4,0,.2,1); }
  .tc-skeleton:hover { transform: none; box-shadow: 0 1px 3px rgba(16,24,40,.06); }
  .tc-skel-line { background: linear-gradient(90deg,#eef0f3 25%,#e3e6ea 37%,#eef0f3 63%);
    background-size: 400% 100%; border-radius: 6px; animation: tc-shimmer 1.4s ease infinite; }
  @keyframes tc-shimmer { 0% { background-position: 100% 0 } 100% { background-position: 0 0 } }
`;

export default Trainee_Courses;