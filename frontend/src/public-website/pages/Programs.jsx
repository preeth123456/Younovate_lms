import React from 'react';
import { useNavigate } from 'react-router-dom';
import SectionShell from '../components/SectionShell';
import PageHeading from '../components/PageHeading';
import ProgramCards from '../components/ProgramCards';
import FAQ from '../components/FAQ';

const programs = [
  {
    key: 'YIEP',
    name: 'YIEP',
    duration: '12 Weeks',
    projects: '6+ Industry-ready Projects',
    certificate: 'AI Expertise Certificate',
    overview: 'A structured AI career program focused on practical skills, assignments, live projects, assessments, and industry readiness.',
    pills: [
      { label: 'Industry Projects', kind: 'accent' },
      { label: 'Weekly Reviews', kind: 'teal' },
      { label: 'Portfolio Building', kind: 'brand' },
    ],
    stats: [
      { label: 'Duration', value: '12 Weeks' },
      { label: 'Projects', value: '6+ real deliverables' },
      { label: 'Assignments', value: 'Weekly assessments' },
      { label: 'Mentorship', value: 'Guided feedback' },
    ],
  },
  {
    key: 'YBLP',
    name: 'YBLP',
    duration: '10 Weeks',
    projects: '5+ Capstone Deliverables',
    certificate: 'Placement-Ready Certificate',
    overview: 'A leadership-focused AI learning program that builds communication, leadership, project execution, presentation skills, and AI implementation.',
    pills: [
      { label: 'Leadership', kind: 'accent' },
      { label: 'Management', kind: 'brand' },
      { label: 'Capstone', kind: 'teal' },
    ],
    stats: [
      { label: 'Duration', value: '10 Weeks' },
      { label: 'Projects', value: '5+ capstone deliverables' },
      { label: 'Assignments', value: 'Team tasks + reviews' },
      { label: 'Mentorship', value: 'Lead coaching' },
    ],
  },
];

const faqItems = [
  { q: 'What are YIEP and YBLP?', a: 'YouVA OS has two AI programs—YIEP (industry experience for builders) and YBLP (branch leadership for execution and presentation). Both connect workshops to projects, assessments, certificates, and placement readiness.' },
  { q: 'Do programs include projects and assignments?', a: 'Yes. Each program includes weekly assignments, real project work, assessments, and a certificate tied to completion and deliverables.' },
  { q: 'Who can join?', a: 'Students, working professionals, and college cohorts. Choose the track that matches your goal—portfolio building (YIEP) or leadership execution (YBLP).' },
  { q: 'What do I get at the end?', a: 'A certificate, portfolio deliverables, and placement support (career roadmap, interview preparation, and progress tracking aligned to your program track).' },
];

const curriculumItems = [
  { t: 'Learning Outcomes', d: 'Module-based goals with measurable checkpoints.' },
  { t: 'Projects Included', d: 'Real deliverables tied to your program track.' },
  { t: 'Assessments', d: 'Weekly evaluation to keep you improving.' },
  { t: 'Capstone', d: 'Portfolio-grade final outcomes for each program.' },
  { t: 'Certificate', d: 'Certificate aligned to completion and deliverables.' },
  { t: 'Career Outcomes', d: 'Roadmap + interview preparation integrated into progress.' },
];

export default function Programs() {
  const navigate = useNavigate();

  return (
    <div style={{ background: '#F8FAFC', paddingBottom: 90 }}>
      <section style={{ paddingTop: 80 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <PageHeading
            eyebrow="AI PROGRAMS"
            title="Two premium programs built for career outcomes"
            description="YIEP and YBLP are structured AI learning paths—each combines assignments, real projects, mentorship, assessments, certificates, and placement support."
          />
        </div>
      </section>

      <SectionShell paddingY={26} paddingBottom={18}>
        <ProgramCards programs={programs} />
      </SectionShell>

      {/* Curriculum + Compare */}
      <SectionShell paddingY={10} paddingBottom={22}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 16, alignItems: 'start' }}>
          {/* Curriculum snapshot */}
          <div style={{ borderRadius: 24, background: '#FFFFFF', border: '1px solid #E2E8F0', padding: 24, boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 8px 24px rgba(30,58,138,0.08)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#1E3A8A', textTransform: 'uppercase', marginBottom: 10 }}>
              Program Curriculum Snapshot
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', marginBottom: 10 }}>
              From workshops to projects to certification
            </div>
            <p style={{ color: '#475569', lineHeight: 1.8, fontSize: 14, marginBottom: 20 }}>
              Programs are designed to compound your learning. You start with workshop-built skills, then convert them into assignments, assessments, portfolio projects, and finally certificates with placement readiness support.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
              {curriculumItems.map((x) => (
                <div key={x.t} style={{ borderRadius: 14, background: 'rgba(30,58,138,0.05)', border: '1px solid rgba(30,58,138,0.10)', padding: 14 }}>
                  <div style={{ fontWeight: 700, color: '#0F172A', fontSize: 13, lineHeight: 1.3 }}>{x.t}</div>
                  <div style={{ marginTop: 6, color: '#475569', lineHeight: 1.6, fontSize: 12 }}>{x.d}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick compare */}
          <div style={{ borderRadius: 24, background: '#FFFFFF', border: '1px solid #E2E8F0', padding: 24, boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 8px 24px rgba(30,58,138,0.08)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#2563EB', textTransform: 'uppercase', marginBottom: 10 }}>
              Quick Compare
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', marginBottom: 14 }}>YIEP vs YBLP</div>
            <div style={{ padding: 14, borderRadius: 14, background: 'rgba(30,58,138,0.05)', border: '1px solid rgba(30,58,138,0.12)', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1E3A8A', marginBottom: 4 }}>⚡ YIEP</div>
              <div style={{ color: '#475569', fontSize: 13, lineHeight: 1.7 }}>Industry projects, portfolio building, weekly reviews, mentorship, and technical deliverables.</div>
            </div>
            <div style={{ padding: 14, borderRadius: 14, background: 'rgba(30,58,138,0.05)', border: '1px solid rgba(30,58,138,0.08)', marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#2563EB', marginBottom: 4 }}>🚀 YBLP</div>
              <div style={{ color: '#475569', fontSize: 13, lineHeight: 1.7 }}>Leadership execution, presentations, team projects, capstone deliverables, and management-oriented AI implementation.</div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {/* // Sign Up hidden — account creation is not active right now.
              <button onClick={() => navigate('/signup')} style={{ width: '100%', padding: '13px 16px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #1E3A8A, #2563EB)', color: '#fff', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 20px rgba(37,99,235,0.25)' }}>
                Register for a Program
              </button>
              */}
              <button onClick={() => navigate('/workshops')} style={{ width: '100%', padding: '13px 16px', borderRadius: 12, border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#0F172A', fontWeight: 700, cursor: 'pointer' }}>
                Explore Workshops First
              </button>
            </div>
          </div>
        </div>
      </SectionShell>

      {/* FAQ */}
      <SectionShell paddingY={10} paddingBottom={22}>
        <div style={{ borderRadius: 24, background: '#FFFFFF', border: '1px solid #E2E8F0', padding: 24, boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 8px 24px rgba(30,58,138,0.08)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#1E3A8A', textTransform: 'uppercase', marginBottom: 8 }}>Program FAQ</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', marginBottom: 20 }}>Everything you need to know</div>
          <FAQ items={faqItems} />
        </div>
      </SectionShell>

      {/* CTA */}
      <SectionShell paddingY={18} paddingBottom={90}>
        <div style={{ borderRadius: 24, background: 'linear-gradient(135deg, #1E3A8A, #2563EB)', padding: 32, boxShadow: '0 8px 40px rgba(30,58,138,0.25)', border: '1px solid rgba(30,58,138,0.3)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -60, right: -60, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.08), transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#93C5FD', marginBottom: 10 }}>Ready to choose your track?</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.15, marginBottom: 10 }}>Register and start building portfolio-grade AI projects.</div>
          <p style={{ color: 'rgba(255,255,255,0.80)', lineHeight: 1.8, marginBottom: 20 }}>Sign up for YouVA OS and pick YIEP or YBLP. You'll get workshops, assignments, mentorship, assessments, certificates, and placement support.</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {/* // Sign Up hidden — account creation is not active right now.
            <button onClick={() => navigate('/signup')} style={{ padding: '13px 24px', borderRadius: 12, border: 'none', background: '#fff', color: '#1E3A8A', fontWeight: 700, cursor: 'pointer', fontSize: 15 }}>Sign Up</button>
            */}
            <button onClick={() => navigate('/workshops')} style={{ padding: '13px 24px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.35)', background: 'transparent', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 15 }}>Explore Workshops</button>
          </div>
        </div>
      </SectionShell>
    </div>
  );
}
