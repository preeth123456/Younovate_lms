import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPublicWorkshops, selectPublicWorkshops, selectPublicStatus } from '../../features/workshops/workshopSlice';

import SectionShell from '../components/SectionShell';
import { youvaTheme } from '../components/youvaTokens';

import PrimaryButton from '../components/PrimaryButton';
import OutlineButton from '../components/OutlineButton';

import PremiumAIHeroScene from '../components/PremiumAIHeroScene';

import ProgramCards from '../components/ProgramCards';
import FeatureCards from '../components/FeatureCards';
import Timeline from '../components/Timeline';
import WorkshopCards from '../components/WorkshopCards';
import WhyCards from '../components/WhyCards';
import SuccessStories from '../components/SuccessStories';
import LogoCarousel from '../components/LogoCarousel';
import FAQ from '../components/FAQ';
import CtaBar from '../components/CtaBar';

function AnimatedCounter({ value, suffix = '', durationMs = 1200 }) {
  const [display, setDisplay] = React.useState(0);

  React.useEffect(() => {
    let raf = 0;
    const start = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * value));
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return (
    <span style={{ fontWeight: 1000, color: youvaTheme.colors.text }}>
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}

export default function Home() {
  const navigate = useNavigate();

  const programs = [
    {
      key: 'YIEP',
      name: 'YIEP',
      overview: 'A structured AI career program with weekly reviews, industry projects, and portfolio deliverables.',
      duration: '12 Weeks',
      certificate: 'AI Expertise Certificate',
      stats: [
        { label: 'Duration', value: '12 Weeks' },
        { label: 'Projects', value: '6+ Industry-ready Projects' },
        { label: 'Assignments', value: 'Weekly Assessments' },
        { label: 'Mentorship', value: 'Guided Feedback' },
      ],
      pills: [
        { label: 'Industry Projects', kind: 'accent' },
        { label: 'Weekly Reviews', kind: 'teal' },
        { label: 'Portfolio Building', kind: 'brand' },
      ],
    },
    {
      key: 'YBLP',
      name: 'YBLP',
      overview: 'A leadership-focused AI learning journey that builds communication, execution, and presentation skills.',
      duration: '10 Weeks',
      certificate: 'Placement-Ready Certificate',
      stats: [
        { label: 'Duration', value: '10 Weeks' },
        { label: 'Projects', value: '5+ Capstone Deliverables' },
        { label: 'Assignments', value: 'Team Tasks + Reviews' },
        { label: 'Mentorship', value: 'Lead Coaching' },
      ],
      pills: [
        { label: 'Leadership', kind: 'accent' },
        { label: 'Management', kind: 'brand' },
        { label: 'Capstone', kind: 'teal' },
      ],
    },
  ];

  const dispatch = useDispatch();
  const workshopPreview = useSelector(selectPublicWorkshops);
  const workshopStatus  = useSelector(selectPublicStatus);

  useEffect(() => {
    dispatch(fetchPublicWorkshops({ limit: 4 }));
  }, [dispatch]);

  const whyCards = [
    { title: 'AI Powered LMS', description: 'Learn with structured paths + intelligent progress signals.', icon: '⚡', kind: 'accent' },
    { title: 'Practical Learning', description: 'Assignments and projects built for real AI outcomes.', icon: '🧩', kind: 'teal' },
    { title: 'Live Workshops', description: 'Watch, practice, and apply during instructor-led sessions.', icon: '🎥', kind: 'brand' },
    { title: 'AI Mentor Support', description: 'Feedback loops that sharpen your portfolio and skills.', icon: '🧠', kind: 'brand' },
    { title: 'Certificates', description: 'Completion and expertise certificates tied to deliverables.', icon: '🏅', kind: 'accent' },
    { title: 'Placement Assistance', description: 'Career roadmap, interview prep, and progress-based guidance.', icon: '🎯', kind: 'teal' },
    { title: 'Progress Dashboard', description: 'Track assignments, projects, attendance, and certifications.', icon: '📈', kind: 'brand' },
    { title: 'Career Roadmap', description: 'A clear plan from workshop learning to placement-ready outcomes.', icon: '🗺️', kind: 'brand' },
  ];

  const timelineSteps = [
    { label: 'Step 1', title: 'Discover AI' },
    { label: 'Step 2', title: 'Register' },
    { label: 'Step 3', title: 'Attend Workshop' },
    { label: 'Step 4', title: 'Complete Assignments' },
    { label: 'Step 5', title: 'Build Projects' },
    { label: 'Step 6', title: 'Get Certified' },
  ];

  const faqItems = [
    {
      q: 'What is YouVA OS?',
      a: 'YouVA OS is the official AI Learning Platform of Younovate—combining AI programs (YIEP & YBLP), live workshops, assignments, projects, mentoring, certificates, and placement support into one next-generation learning ecosystem.',
    },
    {
      q: 'What is the difference between YIEP and YBLP?',
      a: 'YIEP focuses on hands-on industry projects and portfolio building for strong technical foundations. YBLP focuses on leadership and AI execution—communication, management, team projects, and capstone outcomes.',
    },
    {
      q: 'Are workshops free?',
      a: 'Some workshops are free and some are paid—each workshop includes instructor-led demos and practical exercises. Certificate options depend on the session.',
    },
    {
      q: 'Will certificates be provided?',
      a: 'Yes. Programs include certificates based on completion and deliverables. Workshops may also include certificate options depending on the session structure.',
    },
    {
      q: 'How do I register?',
      a: 'Use Sign Up on the Home page (choose YIEP or YBLP), or register for an upcoming workshop from the AI Workshops page.',
    },
    {
      q: 'Can college students join?',
      a: 'Yes. YouVA OS is designed for students, professionals, colleges, and organizations—choose the pathway that matches your goals and background.',
    },
    {
      q: 'Will placement support be provided?',
      a: 'Yes—placement assistance is part of the YouVA OS ecosystem. You’ll get a structured career roadmap, interview preparation, and progress-based guidance aligned to your program track.',
    },
  ];

  return (
    <div style={{ background: youvaTheme.colors.bg }}>
      {/* SECTION 1 — Hero */}
      <section style={{ padding: '72px 0 20px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <style>{`
            @media(max-width:900px){
              .home-hero-flex{flex-direction:column!important}
              .home-hero-text{flex:unset!important;width:100%!important}
              .home-kpi-grid{grid-template-columns:1fr 1fr!important}
              .home-h1{font-size:36px!important}
              .home-section-h2{font-size:28px!important}
            }
            @media(max-width:560px){
              .home-kpi-grid{grid-template-columns:1fr!important}
              .home-h1{font-size:28px!important}
              .home-hero-btns{flex-direction:column!important}
            }
          `}</style>
          <div className="home-hero-flex" style={{ display: 'flex', flexWrap: 'wrap', gap: 22, alignItems: 'center' }}>
            <div className="home-hero-text" style={{ flex: '1 1 540px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 14px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.75)',
                  border: `1px solid ${youvaTheme.colors.borderSoft}`,
                  boxShadow: '0 18px 50px rgba(30,58,138,0.06)',
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: 'linear-gradient(135deg,#1E3A8A,#2563EB)',
                  }}
                />
                <span style={{ fontWeight: 1000, color: youvaTheme.colors.text, fontSize: 12 }}>
                  YouVA OS • Official AI Learning Platform of Younovate
                </span>
              </div>

              <h1 className="home-h1" style={{ marginTop: 18, fontSize: 52, fontWeight: 1000, color: youvaTheme.colors.text, lineHeight: 1.02 }}>
                Build Your AI Career with Practical Learning.
              </h1>

              <p style={{ marginTop: 14, fontSize: 16, color: youvaTheme.colors.muted, fontWeight: 850, lineHeight: 1.8, maxWidth: 720 }}>
                Master Artificial Intelligence through industry-ready programs, live workshops, real-world projects, expert mentorship, and career guidance.
              </p>

              <div className="home-hero-btns" style={{ display: 'flex', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
                {/* // Sign Up hidden — account creation is not active right now.
                <PrimaryButton onClick={() => navigate('/signup')}>Sign Up</PrimaryButton>
                */}
                <OutlineButton onClick={() => navigate('/workshops')}>Explore Workshops</OutlineButton>
                <button
                  onClick={() => navigate('/login')}
                  style={{
                    padding: '12px 8px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: youvaTheme.colors.text,
                    fontWeight: 900,
                    textDecoration: 'underline',
                  }}
                >
                  Login
                </button>
              </div>

              {/* Floating KPI cards */}
              <div className="home-kpi-grid" style={{ marginTop: 26, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                {[
                  { n: 5000, suffix: '+', label: 'Students' },
                  { n: 150, suffix: '+', label: 'AI Workshops' },
                  { n: 100, suffix: '+', label: 'Projects' },
                  { n: 98, suffix: '%', label: 'Completion Rate' },
                ].map((c) => (
                  <div
                    key={c.label}
                    style={{
                      padding: 16,
                      borderRadius: 18,
                      background: '#FFFFFF',
                      border: `1px solid ${youvaTheme.colors.borderSoft}`,
                      boxShadow: '0 18px 50px rgba(30,58,138,0.05)',
                      position: 'relative',
                      overflow: 'hidden',
                      transition: 'transform 180ms ease, box-shadow 180ms ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 24px 70px rgba(30,58,138,0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0px)';
                      e.currentTarget.style.boxShadow = '0 18px 50px rgba(30,58,138,0.05)';
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        inset: -60,
                        background:
                          'radial-gradient(circle at 30% 20%, rgba(37,99,235,0.10), transparent 45%), radial-gradient(circle at 80% 60%, rgba(37,99,235,0.08), transparent 50%)',
                        pointerEvents: 'none',
                      }}
                    />
                    <div style={{ position: 'relative' }}>
                      <div style={{ fontSize: 12, fontWeight: 1000, color: youvaTheme.colors.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        YouVA OS
                      </div>
                      <div style={{ marginTop: 8, fontWeight: 1000, color: youvaTheme.colors.text, fontSize: 30, lineHeight: 1.1 }}>
                        <AnimatedCounter value={c.n} suffix={c.suffix} />
                      </div>
                      <div style={{ marginTop: 6, fontWeight: 900, color: youvaTheme.colors.text, lineHeight: 1.25 }}>{c.label}</div>
                    </div>
                  </div>
                ))}
              </div>

            </div>

            <PremiumAIHeroScene />

          </div>
        </div>
      </section>

      {/* SECTION 2 — Who We Are */}
      <SectionShell paddingY={44} paddingBottom={24}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 1000, letterSpacing: '0.08em', color: youvaTheme.colors.accent, textTransform: 'uppercase' }}>
            Who We Are
          </div>
          <div style={{ marginTop: 10, fontSize: 38, fontWeight: 1000, color: youvaTheme.colors.text }}>Welcome to YouVA OS</div>
          <p style={{ marginTop: 12, color: youvaTheme.colors.muted, fontWeight: 850, lineHeight: 1.9, maxWidth: 920 }}>
            YouVA OS is Younovate's AI-powered Learning Management System built to help students, professionals, colleges, and organizations learn Artificial Intelligence through structured programs and practical workshops.
          </p>

          <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            {[
              { t: 'Live AI Workshops', d: '90-minute instructor-led sessions with hands-on outcomes.' },
              { t: 'Learning Programs', d: 'YIEP and YBLP—structured paths with assessments and deliverables.' },
              { t: 'Assignments', d: 'Clear weekly tasks that build measurable progress.' },
              { t: 'Projects', d: 'Real project work connected to your program modules.' },
              { t: 'Mentorship', d: 'Feedback that improves your portfolio, not just grades.' },
              { t: 'Certification', d: 'Certificates tied to completion and deliverables.' },
              { t: 'Progress Tracking', d: 'Dashboard-based visibility into your learning journey.' },
              { t: 'Placement Support', d: 'Career roadmap and interview preparation aligned to your track.' },
            ].map((x) => (
              <div key={x.t} style={{ borderRadius: 18, background: '#FFFFFF', border: `1px solid ${youvaTheme.colors.borderSoft}`, padding: 16, minHeight: 126 }}>
                <div style={{ fontWeight: 1000, color: youvaTheme.colors.text, lineHeight: 1.25 }}>{x.t}</div>
                <div style={{ marginTop: 8, color: youvaTheme.colors.muted, fontWeight: 850, lineHeight: 1.7, fontSize: 13 }}>{x.d}</div>
              </div>
            ))}
          </div>
        </div>
      </SectionShell>

      {/* SECTION 3 — Our Learning Ecosystem */}
      <SectionShell paddingY={40} paddingBottom={24}>
        <div style={{ borderRadius: 26, background: 'linear-gradient(135deg, rgba(30,58,138,0.06), rgba(37,99,235,0.04))', border: `1px solid ${youvaTheme.colors.border}`, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 1000, letterSpacing: '0.08em', color: youvaTheme.colors.accent, textTransform: 'uppercase' }}>
            Our Learning Ecosystem
          </div>
          <div style={{ marginTop: 10, fontSize: 38, fontWeight: 1000, color: youvaTheme.colors.text }}>Programs + Workshops, built to compound</div>
          <p style={{ marginTop: 12, color: youvaTheme.colors.muted, fontWeight: 850, lineHeight: 1.9, maxWidth: 920 }}>
            Every section of YouVA OS revolves around these three offerings: <b>AI Programs</b> (YIEP & YBLP) and <b>AI Workshops</b>. Each unlocks the next: learning → building → certification → placement readiness.
          </p>

          <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            {[
              {
                title: 'AI Workshops',
                description: '90-minute practical workshops conducted by industry experts focusing on the latest AI tools, productivity, automation, and real-world use cases.',
                features: ['Live Instructor', 'Practical Demo', 'Resources', 'Certificate', 'Community Access'],
                cta: 'Explore Workshops',
              },
              {
                title: 'YIEP',
                description: 'A structured AI program focused on practical skills, assignments, live projects, assessments, and industry readiness.',
                features: ['Industry Projects', 'Assignments', 'Weekly Reviews', 'Mentorship', 'Portfolio Building', 'Certificate'],
                cta: 'Learn More',
              },
              {
                title: 'YBLP',
                description: 'A leadership-focused AI learning program that develops communication, leadership, project execution, presentation skills, and AI implementation.',
                features: ['Leadership', 'Management', 'Presentation', 'Team Projects', 'Capstone', 'Certificate'],
                cta: 'Learn More',
              },
            ].map((c) => (
              <div key={c.title} style={{ borderRadius: 22, background: '#FFFFFF', border: `1px solid ${youvaTheme.colors.borderSoft}`, padding: 16, overflow: 'hidden', boxShadow: '0 18px 50px rgba(30,58,138,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
                  <div>
                    <div style={{ fontWeight: 1000, fontSize: 22, color: youvaTheme.colors.text }}>{c.title}</div>
                    <div style={{ marginTop: 10, color: youvaTheme.colors.muted, fontWeight: 850, lineHeight: 1.8, minHeight: 68 }}>{c.description}</div>
                  </div>
                  <div style={{ width: 60, height: 60, borderRadius: 22, background: 'linear-gradient(135deg, rgba(30,58,138,0.08), rgba(37,99,235,0.08))', border: `1px solid ${youvaTheme.colors.borderSoft}` }} />
                </div>

                <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                  {c.features.map((f) => (
                    <div key={f} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ width: 18, height: 18, borderRadius: 8, background: 'rgba(30,58,138,0.06)', border: '1px solid rgba(30,58,138,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 1000, color: youvaTheme.colors.text, fontSize: 12 }}>✓</span>
                      <span style={{ color: youvaTheme.colors.muted, fontWeight: 850, lineHeight: 1.7, fontSize: 13 }}>{f}</span>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => (c.title === 'AI Workshops' ? navigate('/workshops') : navigate('/programs'))}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 12,
                      border: 'none',
                      background: 'linear-gradient(135deg,#1E3A8A,#2563EB)',
                      color: '#fff',
                      fontWeight: 950,
                      cursor: 'pointer',
                      flex: '1 1 160px',
                    }}
                  >
                    {c.cta}
                  </button>
                  <button
                    // Sign Up hidden — account creation is not active right now.
                    onClick={() => navigate('/signup')}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 12,
                      border: `1.5px solid #CBD5E1`,
                      background: '#F8FAFC',
                      color: youvaTheme.colors.text,
                      fontWeight: 950,
                      cursor: 'pointer',
                      flex: '1 1 160px',
                    }}
                  >
                    Sign Up
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionShell>

      {/* SECTION 4 — Why Students Choose YouVA OS */}
      <SectionShell paddingY={40} paddingBottom={24}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 1000, letterSpacing: '0.08em', color: youvaTheme.colors.accent, textTransform: 'uppercase' }}>
              Why Students Choose YouVA OS
            </div>
            <div style={{ marginTop: 10, fontSize: 38, fontWeight: 1000, color: youvaTheme.colors.text }}>Next-generation LMS + Workshop platform</div>
          </div>
          <div style={{ color: youvaTheme.colors.muted, fontWeight: 850, lineHeight: 1.8, maxWidth: 520 }}>
            AI programs and live workshops reinforce each other—so every session turns into assignments, projects, certificates, and placement readiness.
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <WhyCards items={whyCards} />
        </div>
      </SectionShell>

      {/* SECTION 5 — Learning Journey */}
      <SectionShell paddingY={40} paddingBottom={24}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 1000, letterSpacing: '0.08em', color: youvaTheme.colors.accent, textTransform: 'uppercase' }}>
            Learning Journey
          </div>
          <div style={{ marginTop: 10, fontSize: 38, fontWeight: 1000, color: youvaTheme.colors.text }}>A clear path to AI career readiness</div>
          <div style={{ marginTop: 12, color: youvaTheme.colors.muted, fontWeight: 850, lineHeight: 1.9 }}>
            Discover AI → Register → Attend Workshop → Complete Assignments → Build Projects → Get Certified → Placement Support
          </div>
          <div style={{ marginTop: 20 }}>
            <Timeline steps={timelineSteps} />
          </div>
        </div>
      </SectionShell>

      {/* SECTION 6 — Upcoming AI Workshops */}
      <SectionShell paddingY={40} paddingBottom={24}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 1000, letterSpacing: '0.08em', color: youvaTheme.colors.accent, textTransform: 'uppercase' }}>
              Upcoming AI Workshops
            </div>
            <div style={{ marginTop: 10, fontSize: 38, fontWeight: 1000, color: youvaTheme.colors.text }}>Live sessions designed for immediate application</div>
          </div>
          <button
            onClick={() => navigate('/workshops')}
            style={{ padding: '10px 14px', borderRadius: 12, border: '1.5px solid #CBD5E1', background: '#F8FAFC', color: youvaTheme.colors.text, fontWeight: 950, cursor: 'pointer' }}
          >
            View All Workshops
          </button>
        </div>

        <div style={{ marginTop: 18 }}>
          {workshopStatus === 'loading' ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8' }}>Loading workshops...</div>
          ) : (
            <WorkshopCards
              workshops={workshopPreview}
              onDetails={(w) => (window.location.href = `/workshops/${w._id || w.id}`)}
              onRegister={(w) => (window.location.href = `/workshop/register?workshopId=${w._id || w.id}`)}
            />
          )}
        </div>
      </SectionShell>

      {/* SECTION 7 — Featured AI Programs */}
      <SectionShell paddingY={40} paddingBottom={24}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 1000, letterSpacing: '0.08em', color: youvaTheme.colors.accent, textTransform: 'uppercase' }}>
              Featured AI Programs
            </div>
            <div style={{ marginTop: 10, fontSize: 38, fontWeight: 1000, color: youvaTheme.colors.text }}>Only two programs. Built for real outcomes.</div>
            <div style={{ marginTop: 12, color: youvaTheme.colors.muted, fontWeight: 850, lineHeight: 1.9, maxWidth: 640 }}>
              Choose YIEP to build strong technical execution and portfolio projects, or choose YBLP to develop leadership and capstone-ready outcomes.
            </div>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <ProgramCards programs={programs} />
        </div>
      </SectionShell>

      {/* SECTION 8 — Our Platform Features */}
      <SectionShell paddingY={40} paddingBottom={24}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 1000, letterSpacing: '0.08em', color: youvaTheme.colors.accent, textTransform: 'uppercase' }}>
            Our Platform Features
          </div>
          <div style={{ marginTop: 10, fontSize: 38, fontWeight: 1000, color: youvaTheme.colors.text }}>A unified learning + workshop workflow</div>
          <div style={{ marginTop: 12, color: youvaTheme.colors.muted, fontWeight: 850, lineHeight: 1.9 }}>
            Student Dashboard, Trainer Dashboard, Admin Dashboard—plus attendance, assignments, assessments, projects, certificates, and workshop management. Everything stays connected.
          </div>

          <div style={{ marginTop: 18 }}>
            <FeatureCards
              items={[
                { title: 'Student Dashboard', description: 'Track progress across assignments, projects, certificates, and attendance.', icon: '🎓', kind: 'accent' },
                { title: 'Trainer Dashboard', description: 'Manage workshops and guide sessions with structure.', icon: '🧑‍🏫', kind: 'brand' },
                { title: 'Admin Dashboard', description: 'Oversee cohorts, sessions, and reporting with clarity.', icon: '🛠️', kind: 'brand' },
                { title: 'Attendance', description: 'Live participation tracking and workshop readiness visibility.', icon: '⏱️', kind: 'teal' },
                { title: 'Assignments', description: 'Structured submissions aligned to program modules.', icon: '✅', kind: 'brand' },
                { title: 'Assessments', description: 'Evaluate skill growth using measurable tasks and reviews.', icon: '🧪', kind: 'accent' },
                { title: 'Projects & Certificates', description: 'Deliverables that turn into certificates and career proof.', icon: '🏅', kind: 'accent' },
                { title: 'Placement Tracking', description: 'Interview prep, progress signals, and career roadmap support.', icon: '🎯', kind: 'teal' },
              ]}
            />
          </div>
        </div>
      </SectionShell>

      {/* SECTION 9 — Success Stories */}
      <SectionShell paddingY={40} paddingBottom={24}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 1000, letterSpacing: '0.08em', color: youvaTheme.colors.accent, textTransform: 'uppercase' }}>
            Success Stories
          </div>
          <div style={{ marginTop: 10, fontSize: 38, fontWeight: 1000, color: youvaTheme.colors.text }}>Video testimonials + measurable outcomes</div>
          <div style={{ marginTop: 12, color: youvaTheme.colors.muted, fontWeight: 850, lineHeight: 1.9 }}>
            Project showcases, placement success, and learner growth—powered by YouVA OS programs and live workshops.
          </div>
          <div style={{ marginTop: 18 }}>
            <SuccessStories />
          </div>
        </div>
      </SectionShell>

      {/* SECTION 10 — Partner Institutions */}
      <SectionShell paddingY={36} paddingBottom={24}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 1000, letterSpacing: '0.08em', color: youvaTheme.colors.accent, textTransform: 'uppercase' }}>
            Partner Institutions
          </div>
          <div style={{ marginTop: 10, fontSize: 38, fontWeight: 1000, color: youvaTheme.colors.text }}>Colleges, Universities, Corporate Partners</div>
          <div style={{ marginTop: 12, color: youvaTheme.colors.muted, fontWeight: 850, lineHeight: 1.9 }}>
            We collaborate with educational and corporate stakeholders to deliver structured AI cohorts with workshops, projects, assessments, and career support.
          </div>
          <div style={{ marginTop: 18 }}>
            <LogoCarousel />
          </div>
        </div>
      </SectionShell>

      {/* SECTION 11 — Frequently Asked Questions */}
      <SectionShell paddingY={40} paddingBottom={24}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 1000, letterSpacing: '0.08em', color: youvaTheme.colors.accent, textTransform: 'uppercase' }}>
            Frequently Asked Questions
          </div>
          <div style={{ marginTop: 10, fontSize: 38, fontWeight: 1000, color: youvaTheme.colors.text }}>Decide with clarity</div>
          <div style={{ marginTop: 12, color: youvaTheme.colors.muted, fontWeight: 850, lineHeight: 1.9 }}>
            Answers about YouVA OS, YIEP vs YBLP, workshops, certificates, registration, and placement support.
          </div>

          <div style={{ marginTop: 18 }}>
            <FAQ items={faqItems} />
          </div>
        </div>
      </SectionShell>

      {/* SECTION 12 — Call To Action */}
      <SectionShell paddingY={32} paddingBottom={90}>
        <CtaBar />
      </SectionShell>
    </div>
  );
}


