import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Award, BadgeCheck, BookOpen, BriefcaseBusiness, Building2,
  CalendarDays, Camera, Check, ChevronDown, CircleUserRound, ClipboardList,
  GraduationCap, Hash, Link2, Mail, MapPin, Pencil, Phone, ShieldCheck,
  Sparkles, Target, UserRound, X,
} from "lucide-react";
import "./Profile.css";
import "./Profile_photo_input.css";
import { API_BASE_URL } from "../../config/api";

const BASE_URL = API_BASE_URL;

const COMMON_EDITABLE_FIELDS = [
  "name", "phone", "bio", "linkedIn", "github", "gender",
  "dateOfBirth", "address", "city", "state", "country", "pincode",
];

const ROLE_EDITABLE_FIELDS = {
  admin:   ["designation", "department", "employeeId", "experience", "specialization"],
  hr:      ["designation", "department", "employeeId", "experience", "specialization"],
  trainer: ["designation", "department", "expertise", "experience", "specialization", "certifications", "currentCompany", "portfolioUrl"],
  trainee: ["skills", "collegeName", "degree", "branch", "graduationYear", "portfolioUrl", "resumeUrl"],
};

const ARRAY_FIELDS  = new Set(["skills", "expertise", "certifications"]);
const NUMBER_FIELDS = new Set(["experience", "graduationYear"]);
const DATE_FIELDS   = new Set(["dateOfBirth", "enrolledAt", "lastLoginAt", "placementUpdatedAt"]);

const ROLE_META = {
  admin:   { label: "Admin",   track: "LMS Administration",   icon: ShieldCheck,       accent: "admin"   },
  trainee: { label: "Trainee", track: "Learning Program",     icon: GraduationCap,     accent: "trainee" },
  trainer: { label: "Trainer", track: "Training Delivery",    icon: BriefcaseBusiness, accent: "trainer" },
  hr:      { label: "HR",      track: "Placement Operations", icon: Building2,         accent: "hr"      },
};

const FIELD_LABELS = {
  name: "Full name", phone: "Phone", bio: "Bio",
  profilePicture: "Profile photo URL", linkedIn: "LinkedIn", github: "GitHub",
  gender: "Gender", dateOfBirth: "Date of birth", address: "Address",
  city: "City", state: "State", country: "Country", pincode: "Pincode",
  designation: "Designation", department: "Department", employeeId: "Employee ID",
  experience: "Experience", specialization: "Specialization", expertise: "Expertise",
  certifications: "Certifications", currentCompany: "Current company",
  portfolioUrl: "Portfolio", skills: "Skills", collegeName: "College name",
  degree: "Degree", branch: "Branch", graduationYear: "Graduation year", resumeUrl: "Resume",
};

export function getEditableProfileKeys(role) {
  return [...COMMON_EDITABLE_FIELDS, ...(ROLE_EDITABLE_FIELDS[role] || [])];
}

export function createProfileForm(user = {}) {
  const keys = new Set([
    ...COMMON_EDITABLE_FIELDS,
    ...Object.values(ROLE_EDITABLE_FIELDS).flat(),
  ]);
  const form = {};
  keys.forEach((key) => {
    if (ARRAY_FIELDS.has(key))       form[key] = Array.isArray(user[key]) ? user[key] : [];
    else if (DATE_FIELDS.has(key))   form[key] = toDateInput(user[key]);
    else if (NUMBER_FIELDS.has(key)) form[key] = user[key] ?? "";
    else                             form[key] = user[key] ?? "";
  });
  return form;
}

export function buildProfilePatch(form, user) {
  const patch = {};
  getEditableProfileKeys(user?.role).forEach((key) => {
    const nextComparable = normalizeComparableValue(key, form[key]);
    const prevComparable = normalizeComparableValue(key, user?.[key]);
    if (ARRAY_FIELDS.has(key)) {
      const changed =
        nextComparable.length !== prevComparable.length ||
        nextComparable.some((v, i) => v !== prevComparable[i]);
      if (changed) patch[key] = nextComparable;
      return;
    }
    if (nextComparable !== prevComparable) patch[key] = normalizeValueForSave(key, form[key]);
  });
  return patch;
}

function normalizeComparableValue(key, value) {
  if (ARRAY_FIELDS.has(key))  return Array.isArray(value) ? value : [];
  if (DATE_FIELDS.has(key))   return toDateInput(value);
  if (NUMBER_FIELDS.has(key)) return value === null || value === undefined ? "" : String(value);
  return value === null || value === undefined ? "" : String(value);
}

function normalizeValueForSave(key, value) {
  if (ARRAY_FIELDS.has(key))  return Array.isArray(value) ? value : [];
  if (DATE_FIELDS.has(key))   return value ? value : null;
  if (NUMBER_FIELDS.has(key)) return value === "" || value === null || value === undefined ? null : Number(value);
  return typeof value === "string" ? value.trim() : value;
}

function toDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "YN";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function humanize(value = "") {
  return String(value).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isFilled(value) {
  if (Array.isArray(value))      return value.length > 0;
  if (typeof value === "number") return true;
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function getBatchLabel(batchId) {
  if (!batchId) return "";
  if (typeof batchId === "object") return batchId.name || batchId.title || batchId.batchName || batchId._id || "";
  return batchId;
}

function getTrackLabel(user) {
  const role = user?.role || "trainee";
  if (role === "trainee") return user?.programName || user?.courseName || "Younovate Learning Program";
  if (role === "trainer") return user?.specialization || user?.currentCompany || ROLE_META.trainer.track;
  if (role === "hr")      return user?.department || ROLE_META.hr.track;
  return user?.department || ROLE_META.admin.track;
}

function fieldValueForDisplay(field, form, user) {
  if (field.getValue) return field.getValue(user);
  if (field.readOnly)  return user?.[field.key];
  return form[field.key];
}

function formatFieldValue(field, value) {
  if (field.format)                    return field.format(value);
  if (ARRAY_FIELDS.has(field.key))     return Array.isArray(value) ? value.join(", ") : "";
  if (DATE_FIELDS.has(field.key))      return formatDate(value);
  if (field.key === "role")            return humanize(value);
  if (field.key === "isActive")        return value === false ? "Inactive" : "Active";
  if (field.key === "placementStatus") return humanize(value || "enrolled");
  if (field.suffix && isFilled(value)) return `${value} ${field.suffix}`;
  return value;
}

function resolveProfileImageUrl(profilePicture) {
  if (!profilePicture) return null;
  if (profilePicture.startsWith("blob:")) return profilePicture;
  if (profilePicture.startsWith("http"))  return profilePicture;
  return `${BASE_URL}${profilePicture}`;
}

function makeSections(role) {
  const commonImportant = [
    { key: "name",        label: "Full name",     icon: UserRound,       placeholder: "Enter full name" },
    { key: "email",       label: "Email",         icon: Mail,            readOnly: true },
    { key: "phone",       label: "Phone",         icon: Phone,           placeholder: "+91 98765 43210" },
    { key: "bio",         label: "Bio",           icon: ClipboardList,   type: "textarea", full: true, placeholder: "Short professional summary" },
    { key: "gender",      label: "Gender",        icon: CircleUserRound, type: "select",   options: ["", "Male", "Female", "Other"] },
    { key: "dateOfBirth", label: "Date of birth", icon: CalendarDays,    type: "date" },
  ];
  const locationContact = [
    { key: "address",  label: "Address",  icon: MapPin, full: true, placeholder: "Street / locality" },
    { key: "city",     label: "City" },
    { key: "state",    label: "State" },
    { key: "country",  label: "Country" },
    { key: "pincode",  label: "Pincode" },
    { key: "linkedIn", label: "LinkedIn", icon: Link2, type: "url", placeholder: "https://linkedin.com/in/..." },
    { key: "github",   label: "GitHub",   icon: Link2, type: "url", placeholder: "https://github.com/..." },
  ];

  if (role === "trainee") {
    return [
      { id: "important", title: "Important Details",    icon: BadgeCheck,    fields: commonImportant },
      { id: "program",   title: "Program Info",         icon: GraduationCap, fields: [
          { key: "batchId",         label: "Batch ID",         icon: Hash,         readOnly: true, getValue: (u) => getBatchLabel(u?.batchId) },
          { key: "placementStatus", label: "Placement status", icon: Target,       readOnly: true },
          { key: "enrolledAt",      label: "Enrolled at",      icon: CalendarDays, readOnly: true },
          { key: "skills",          label: "Skills",           icon: Sparkles,     type: "chips", full: true },
        ],
      },
      { id: "learning", title: "Learning Preference", icon: BookOpen, fields: [
          { key: "collegeName",    label: "College name",    icon: Building2,    full: true },
          { key: "degree",         label: "Degree",          icon: GraduationCap },
          { key: "branch",         label: "Branch" },
          { key: "graduationYear", label: "Graduation year", icon: CalendarDays, type: "number" },
        ],
      },
      { id: "contact",      title: "Location & Contact", icon: MapPin,            fields: locationContact },
      { id: "professional", title: "Professional",        icon: BriefcaseBusiness, fields: [
          { key: "portfolioUrl",  label: "Portfolio",      icon: Link2,     type: "url" },
          { key: "resumeUrl",     label: "Resume",         icon: Link2,     type: "url" },
          { key: "companyName",   label: "Placed company", icon: Building2, readOnly: true },
          { key: "ctc",           label: "CTC",            readOnly: true },
          { key: "placementNote", label: "Placement note", readOnly: true,  full: true },
        ],
      },
    ];
  }

  if (role === "trainer") {
    return [
      { id: "important", title: "Important Details", icon: BadgeCheck,    fields: commonImportant },
      { id: "program",   title: "Program Info",      icon: ClipboardList, fields: [
          { key: "designation",    label: "Designation",     icon: BriefcaseBusiness },
          { key: "department",     label: "Department",      icon: Building2 },
          { key: "currentCompany", label: "Current company", icon: Building2 },
          { key: "experience",     label: "Experience",      icon: Award, type: "number", suffix: "years" },
          { key: "specialization", label: "Specialization",  icon: Target, full: true },
        ],
      },
      { id: "learning", title: "Learning Preference", icon: Sparkles, fields: [
          { key: "expertise",      label: "Expertise",      icon: Sparkles, type: "chips", full: true },
          { key: "certifications", label: "Certifications", icon: Award,    type: "chips", full: true },
        ],
      },
      { id: "contact",      title: "Location & Contact", icon: MapPin,            fields: locationContact },
      { id: "professional", title: "Professional",        icon: BriefcaseBusiness, fields: [
          { key: "portfolioUrl", label: "Portfolio",      icon: Link2,       type: "url" },
          { key: "role",         label: "Role",           icon: ShieldCheck, readOnly: true },
          { key: "isActive",     label: "Account status", icon: BadgeCheck,  readOnly: true },
          { key: "lastLoginAt",  label: "Last login",     icon: Activity,    readOnly: true },
        ],
      },
    ];
  }

  const peopleOpsFields = [
    { key: "employeeId",     label: "Employee ID",    icon: Hash },
    { key: "designation",    label: "Designation",    icon: BriefcaseBusiness },
    { key: "department",     label: "Department",     icon: Building2 },
    { key: "experience",     label: "Experience",     icon: Award, type: "number", suffix: "years" },
    { key: "specialization", label: "Specialization", icon: Target, full: true },
  ];

  return [
    { id: "important",    title: "Important Details",                      icon: BadgeCheck,                          fields: commonImportant },
    { id: "program",      title: role === "hr" ? "HR Info" : "Admin Info", icon: role === "hr" ? Building2 : ShieldCheck, fields: peopleOpsFields },
    { id: "contact",      title: "Location & Contact",                     icon: MapPin,                              fields: locationContact },
    { id: "professional", title: "Professional",                           icon: BriefcaseBusiness,                   fields: [
        { key: "role",        label: "Role",           icon: ShieldCheck, readOnly: true },
        { key: "isActive",    label: "Account status", icon: BadgeCheck,  readOnly: true },
        { key: "lastLoginAt", label: "Last login",     icon: Activity,    readOnly: true },
      ],
    },
  ];
}

function getCompletion(form, keys) {
  const completionKeys = keys.filter((k) => k !== "github");
  if (!completionKeys.length) return 0;
  const filled = completionKeys.filter((k) => isFilled(form[k])).length;
  return Math.round((filled / completionKeys.length) * 100);
}

function getSectionMissing(section, form, user, editableKeys) {
  return section.fields
    .filter((f) => !f.readOnly && editableKeys.includes(f.key))
    .filter((f) => !isFilled(fieldValueForDisplay(f, form, user))).length;
}

function scrollToSection(id) {
  document.getElementById(`profile-section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function HeroPill({ icon: Icon, label, value }) {
  return (
    <span className="yp-hero-pill">
      <Icon size={15} />
      <span>{label}</span>
      {value !== undefined && <strong>{value}</strong>}
    </span>
  );
}

function ChipEditor({ value = [], editing, onChange, placeholder }) {
  const [draft, setDraft] = useState("");
  const tags = Array.isArray(value) ? value : [];
  const add = () => {
    const next = draft.trim();
    if (!next) return;
    if (!tags.some((t) => t.toLowerCase() === next.toLowerCase())) onChange([...tags, next]);
    setDraft("");
  };
  return (
    <div className="yp-chip-field">
      {tags.map((tag) => (
        <span className="yp-chip" key={tag}>
          {tag}
          {editing && (
            <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))} aria-label={`Remove ${tag}`}>
              <X size={12} />
            </button>
          )}
        </span>
      ))}
      {editing && (
        <span className="yp-chip-input-wrap">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            placeholder={placeholder || "Add"}
          />
          <button type="button" onClick={add} aria-label="Add item"><Check size={13} /></button>
        </span>
      )}
      {!editing && tags.length === 0 && <span className="yp-empty-value">Not provided</span>}
    </div>
  );
}

function Field({ field, form, user, editing, editableKeys, onChange }) {
  const canEdit      = editing && !field.readOnly && editableKeys.includes(field.key);
  const Icon         = field.icon;
  const rawValue     = fieldValueForDisplay(field, form, user);
  const displayValue = formatFieldValue(field, rawValue);
  const update       = (e) => onChange(field.key, e.target.value);

  if (field.type === "chips") {
    return (
      <div className={`yp-field ${field.full ? "yp-field-full" : ""}`}>
        <label>{field.label || FIELD_LABELS[field.key]}</label>
        <ChipEditor value={rawValue} editing={canEdit} onChange={(value) => onChange(field.key, value)} placeholder="Add" />
      </div>
    );
  }

  return (
    <div className={`yp-field ${field.full ? "yp-field-full" : ""}`}>
      {canEdit ? (
        <div className="yn-field-wrapper">
          <label className="yn-label">{field.label || FIELD_LABELS[field.key]}</label>
          <div className="yn-input-wrap">
            {Icon && <Icon size={16} className="yn-icon" aria-hidden="true" />}
            {field.type === "textarea" ? (
              <textarea
                value={rawValue || ""}
                onChange={update}
                placeholder={field.placeholder}
                className="yn-input yn-textarea"
                rows={4}
              />
            ) : field.type === "select" ? (
              <select
                value={rawValue || ""}
                onChange={update}
                className="yn-input yn-select"
              >
                {field.options.map((o) => <option key={o || "blank"} value={o}>{o || "Select"}</option>)}
              </select>
            ) : (
              <input
                type={field.type || "text"}
                value={rawValue || ""}
                onChange={update}
                placeholder={field.placeholder}
                className="yn-input"
                min={field.type === "number" ? 0 : undefined}
              />
            )}
          </div>
        </div>
      ) : (
        <>
          <label>{field.label || FIELD_LABELS[field.key]}</label>
          <div className="yp-field-value">
            {Icon && <Icon size={16} />}
            {field.type === "url" && displayValue ? (
              <a href={displayValue} target="_blank" rel="noreferrer">{displayValue}</a>
            ) : (
              <span className={isFilled(displayValue) ? "" : "yp-empty-value"}>
                {isFilled(displayValue) ? displayValue : "Not provided"}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SectionCard({ section, form, user, editing, editableKeys, open, onToggle, onFieldChange }) {
  const Icon    = section.icon;
  const missing = getSectionMissing(section, form, user, editableKeys);
  return (
    <section className="yp-section-card" id={`profile-section-${section.id}`}>
      <button className="yp-section-header" type="button" onClick={onToggle} aria-expanded={open}>
        <span className="yp-section-title">
          <span className="yp-section-icon"><Icon size={18} /></span>
          <span>{section.title}</span>
        </span>
        <span className="yp-section-status">
          {missing > 0 ? `${missing} due` : "Done"}
          <ChevronDown size={18} className={open ? "yp-rotated" : ""} />
        </span>
      </button>
      {open && (
        <div className="yp-section-body">
          <div className="yp-field-grid">
            {section.fields.map((field) => (
              <Field
                key={field.key} field={field} form={form} user={user}
                editing={editing} editableKeys={editableKeys} onChange={onFieldChange}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Main Profile component ──────────────────────────────────────────────────

export default function Profile({ user, onSave }) {
   console.log("🔄 Profile render — user.profilePicture:", user?.profilePicture);
  console.log("🔄 Profile render — form.profilePicture:", /* add after form state */);
  const editableKeys = useMemo(() => getEditableProfileKeys(user?.role), [user?.role]);
  const sections     = useMemo(() => makeSections(user?.role), [user?.role]);

  const [form,         setForm]         = useState(() => createProfileForm(user));
  const [editing,      setEditing]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [photoSaving,  setPhotoSaving]  = useState(false);
  const [openSections, setOpenSections] = useState({});

  const photoInputRef = useRef(null);

  // Sync form from Redux user whenever user updates AND we are NOT editing
  useEffect(() => {
    if (!editing) {
      setForm(createProfileForm(user));
    }
  }, [user, editing]);

  // When entering edit mode keep any pending __profilePhotoFile
  useEffect(() => {
    if (editing) {
      setForm((cur) => ({ ...cur, __profilePhotoFile: cur.__profilePhotoFile || null }));
    }
  }, [editing]);

  // Default first two sections open
  useEffect(() => {
    setOpenSections((cur) => {
      const next = { ...cur };
      sections.forEach((s, i) => { if (next[s.id] === undefined) next[s.id] = i < 2; });
      return next;
    });
  }, [sections]);

  if (!user) return null;

  const role         = user.role || "trainee";
  const roleMeta     = ROLE_META[role] || ROLE_META.trainee;
  const RoleIcon     = roleMeta.icon;
  const completion   = getCompletion(form, editableKeys);
  const activeStatus = user.isActive === false ? "Inactive" : "Active";
  const profileImageUrl = resolveProfileImageUrl(form.profilePicture);

  const updateField = (key, value) => setForm((cur) => ({ ...cur, [key]: value }));

  const cancel = () => {
    setForm(createProfileForm(user));
    setEditing(false);
  };

  // Save for the full Edit form (text fields + optional photo together)
  const save = async () => {
    setSaving(true);
    try {
      const blobUrl = form.profilePicture?.startsWith("blob:") ? form.profilePicture : null;
      const saved   = await onSave?.(form);
      if (saved !== false) {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Avatar click → instant photo upload (no Edit mode needed) ─────────────
  const handleAvatarClick = () => {
    if (photoSaving) return;
    photoInputRef.current?.click();
  };

  // const handlePhotoFileChange = async (e) => {
  //   const file = e.target.files?.[0];
  //   if (!file) return;

  //   // Show blob preview immediately
  //   const localUrl = URL.createObjectURL(file);
  //   setForm((cur) => ({ ...cur, profilePicture: localUrl }));

  //   setPhotoSaving(true);
  //   try {
  //     // Pass ONLY __profilePhotoFile so ProfilePage knows it's a photo-only call
  //     // and skips buildProfilePatch / updateProfile entirely
  //     await onSave?.({ __profilePhotoFile: file });
  //     URL.revokeObjectURL(localUrl);
  //     // useEffect([user, editing]) will sync form with fresh DB url automatically
  //   } catch {
  //     URL.revokeObjectURL(localUrl);
  //     setForm((cur) => ({ ...cur, profilePicture: user?.profilePicture ?? "" }));
  //   } finally {
  //     setPhotoSaving(false);
  //     if (photoInputRef.current) photoInputRef.current.value = "";
  //   }
  // };
const handlePhotoFileChange = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const localUrl = URL.createObjectURL(file);
  setForm((cur) => ({ ...cur, profilePicture: localUrl }));

  setPhotoSaving(true);
  try {
    await onSave?.({ __profilePhotoFile: file });
    // ✅ Do NOT revoke here — let the useEffect([user, editing]) run first
    // which will call setForm(createProfileForm(user)) and replace the blob url
    // with the real DB url. Only then is it safe to revoke.
    setTimeout(() => URL.revokeObjectURL(localUrl), 3000); // safe delay
  } catch {
    URL.revokeObjectURL(localUrl);
    setForm((cur) => ({ ...cur, profilePicture: user?.profilePicture ?? "" }));
  } finally {
    setPhotoSaving(false);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }
};
  return (
    <div className="yp-page">

      {/* ── Sidebar rail ── */}
      <aside className="yp-rail" aria-label="Profile sections">
        <div className="yp-progress-card">
          <div className="yp-progress-title">
            <span className="yp-mini-avatar">
              {profileImageUrl ? <img src={profileImageUrl} alt="" /> : initials(form.name)}
            </span>
            <span>{form.name || "Your Profile"}</span>
          </div>
          <div className="yp-progress-meta">
            <span>Profile Progress</span>
            <strong>{completion}%</strong>
          </div>
          <div className="yp-progress-track" aria-hidden="true">
            <span style={{ width: `${completion}%` }} />
          </div>
        </div>

        <nav className="yp-section-nav">
          {sections.map((section) => {
            const Icon    = section.icon;
            const missing = getSectionMissing(section, form, user, editableKeys);
            return (
              <button key={section.id} type="button" onClick={() => scrollToSection(section.id)}>
                <span className={`yp-nav-icon ${missing > 0 ? "yp-nav-due" : ""}`}>
                  <Icon size={16} />
                </span>
                <span>{section.title}</span>
                {missing > 0 && <em>Due</em>}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ── Main content ── */}
      <main className="yp-main">
        <header className="yp-hero">

          {/* ── Avatar — always clickable, no Edit mode required ── */}
          <div className="yp-avatar-wrap">

            {/* Hidden file input — always in DOM */}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handlePhotoFileChange}
            />

            {/* Clickable wrapper */}
            <div
              className="yp-avatar-click-wrap"
              onClick={handleAvatarClick}
              title="Click to change profile photo"
              style={{ cursor: photoSaving ? "wait" : "pointer", position: "relative", display: "inline-block" }}
            >
              {profileImageUrl ? (
                <img
                  className="yp-avatar"
                  src={profileImageUrl}
                  alt={form.name || "Profile"}
                  style={{ opacity: photoSaving ? 0.5 : 1, transition: "opacity 0.2s" }}
                  onError={(e) => { e.target.onerror = null; e.target.style.display = "none"; }}
                />
              ) : (
                <div
                  className={`yp-avatar yp-avatar-fallback yp-role-${role}`}
                  style={{ opacity: photoSaving ? 0.5 : 1, transition: "opacity 0.2s" }}
                >
                  {initials(form.name)}
                </div>
              )}

              {/* Camera icon — pointerEvents none so clicks bubble to wrapper */}
              <span
                className="yp-camera"
                aria-label="Upload profile photo"
                style={{ opacity: photoSaving ? 0.3 : 1, pointerEvents: "none" }}
              >
                <Camera size={16} />
              </span>
            </div>
          </div>

          {/* ── Hero copy ── */}
          <div className="yp-hero-copy">
            <div className="yp-hero-heading">
              <h2>{form.name || "Your name"}</h2>
              <span className={`yp-role-chip yp-role-${role}`}>
                <RoleIcon size={14} />
                {roleMeta.label}
              </span>
            </div>
            <p>{form.bio || "Add a short bio so your team knows what you are working on."}</p>
            <div className="yp-program-line">
              <span>{role === "trainee" ? "Program name" : "Profile track"}</span>
              <strong>{getTrackLabel(user)}</strong>
            </div>
            <div className="yp-hero-pills">
              <HeroPill icon={BadgeCheck} label="Status"  value={activeStatus} />
              <HeroPill icon={Award}      label="Profile" value={`${completion}%`} />
              <HeroPill
                icon={role === "trainee" ? Sparkles : BriefcaseBusiness}
                label={role === "trainee" ? "Skills" : "Experience"}
                value={role === "trainee" ? (form.skills || []).length : form.experience || 0}
              />
              <HeroPill icon={Activity} label="Activity Details" />
            </div>
          </div>

          {/* ── Edit / Save / Cancel ── */}
          <div className="yp-hero-actions">
            {!editing ? (
              <button className="yp-primary-btn" type="button" onClick={() => setEditing(true)}>
                <Pencil size={16} /> Edit
              </button>
            ) : (
              <>
                <button className="yp-ghost-btn" type="button" onClick={cancel} disabled={saving}>
                  <X size={16} /> Cancel
                </button>
                <button className="yp-primary-btn" type="button" onClick={save} disabled={saving}>
                  <Check size={16} /> {saving ? "Saving…" : "Save"}
                </button>
              </>
            )}
          </div>
        </header>

        {/* ── Section cards ── */}
        <div className="yp-sections">
          {sections.map((section) => (
            <SectionCard
              key={section.id}
              section={section} form={form} user={user}
              editing={editing} editableKeys={editableKeys}
              open={Boolean(openSections[section.id])}
              onToggle={() => setOpenSections((cur) => ({ ...cur, [section.id]: !cur[section.id] }))}
              onFieldChange={updateField}
            />
          ))}
        </div>
      </main>
    </div>
  );
}