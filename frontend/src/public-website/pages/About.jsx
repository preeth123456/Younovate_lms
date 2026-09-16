import React from 'react';
import { useNavigate } from 'react-router-dom';

import SectionShell from '../components/SectionShell';
import { youvaTheme } from '../components/youvaTokens';
import PageHeading from '../components/PageHeading';
import AboutTeamGrid from '../components/AboutTeamGrid';
import Timeline from '../components/Timeline';
import LogoCarousel from '../components/LogoCarousel';

export default function About() {
  const navigate = useNavigate();

  const values = [
    {
      title: 'Hands-on over hype',
      body: 'Every session maps to assignments and projects, so learning turns into deliverables—fast.',
    },
    {
      title: 'Mentorship that compounds',
      body: 'Weekly reviews and expert feedback help you improve, not just submit.',
    },
    {
      title: 'Career-aligned outcomes',
      body: 'Certificates and placement support are designed around measurable progress.',
    },
    {
      title: 'Workshop-first execution',
      body: 'YouVA OS starts with live demos and practical workshops—then converts into a full program.',
    },
  ];

  const philosophy = [
    {
      title: 'Learn',
      body: 'Short, instructor-led workshop sessions teach the right AI patterns and workflows.',
    },
    {
      title: 'Build',
      body: 'Programs convert learning into structured assignments and portfolio-grade projects.',
    },
    {
      title: 'Prove',
      body: 'Certificates and assessments verify competence through real deliverables.',
    },
    {
      title: 'Get Ready',
      body: 'Placement support and interview preparation align with your program track.',
    },
  ];

  const journey = [
    { label: 'Phase A', title: 'Discover AI & choose your track' },
    { label: 'Phase B', title: 'Attend live workshops + practice' },
    { label: 'Phase C', title: 'Complete assignments & assessments' },
    { label: 'Phase D', title: 'Build projects & portfolio deliverables' },
    { label: 'Phase E', title: 'Get certified & prepare for interviews' },
    { label: 'Phase F', title: 'Placement readiness support' },
  ];

  return (
    <div style={{ background: youvaTheme.colors.bg, paddingBottom: 90 }}>
      <section style={{ paddingTop: 80 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <PageHeading
            eyebrow="ABOUT YOUVA OS"
            title="A next-generation AI LMS + Workshop Platform"
            description="YouVA OS brings together industry programs (YIEP & YBLP), live AI workshops, mentoring, certificates, and placement support—so learners build real outcomes, not just course completion."
          />
        </div>
      </section>

      <SectionShell paddingY={36} paddingBottom={22}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 16 }}>
          <div style={{ borderRadius: 22, background: '#FFFFFF', border: `1px solid ${youvaTheme.colors.borderSoft}`, padding: 18, boxShadow: youvaTheme.shadow.soft }}>
            <div style={{ fontSize: 12, fontWeight: 1000, letterSpacing: '0.08em', color: youvaTheme.colors.accent, textTransform: 'uppercase' }}>Mission</div>
            <div style={{ marginTop: 10, fontSize: 22, fontWeight: 1000, color: youvaTheme.colors.text }}>Master AI through practical outcomes</div>
            <div style={{ marginTop: 10, color: youvaTheme.colors.muted, fontWeight: 850, lineHeight: 1.9 }}>
              We design learning journeys where every workshop and module produces assignments, projects, certificates, and career-ready proof.
            </div>
          </div>

          <div style={{ borderRadius: 22, background: '#FFFFFF', border: `1px solid ${youvaTheme.colors.borderSoft}`, padding: 18, boxShadow: youvaTheme.shadow.soft }}>
            <div style={{ fontSize: 12, fontWeight: 1000, letterSpacing: '0.08em', color: youvaTheme.colors.brand2, textTransform: 'uppercase' }}>Vision</div>
            <div style={{ marginTop: 10, fontSize: 22, fontWeight: 1000, color: youvaTheme.colors.text }}>Make AI skills measurable and career-driven</div>
            <div style={{ marginTop: 10, color: youvaTheme.colors.muted, fontWeight: 850, lineHeight: 1.9 }}>
              YouVA OS helps learners show competence through deliverables and progress tracking—so success is trackable.
            </div>
          </div>

          <div style={{ borderRadius: 22, background: '#FFFFFF', border: `1px solid ${youvaTheme.colors.borderSoft}`, padding: 18, boxShadow: youvaTheme.shadow.soft }}>
            <div style={{ fontSize: 12, fontWeight: 1000, letterSpacing: '0.08em', color: youvaTheme.colors.text, textTransform: 'uppercase' }}>Our Story</div>
            <div style={{ marginTop: 10, fontSize: 22, fontWeight: 1000, color: youvaTheme.colors.text }}>Built by educators and industry experts</div>
            <div style={{ marginTop: 10, color: youvaTheme.colors.muted, fontWeight: 850, lineHeight: 1.9 }}>
              We combine workshop-driven learning with structured programs so learners don’t just learn—they build and get ready.
            </div>
          </div>
        </div>
      </SectionShell>

      <SectionShell paddingY={10} paddingBottom={22}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 1000, letterSpacing: '0.08em', color: youvaTheme.colors.accent, textTransform: 'uppercase' }}>Why YouVA OS</div>
            <div style={{ marginTop: 10, fontSize: 36, fontWeight: 1000, color: youvaTheme.colors.text }}>The LMS + Workshop loop</div>
            <div style={{ marginTop: 12, color: youvaTheme.colors.muted, fontWeight: 850, lineHeight: 1.9 }}>
              Workshops teach you the skills. Programs convert those skills into assignments and projects. Mentorship refines your execution. Certificates and placement support complete the outcome.
            </div>

            <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 14 }}>
              {[
                'Live instructor sessions',
                'Program modules + assessments',
                'Projects & certificate deliverables',
                'Progress dashboard + attendance tracking',
                'Mentorship feedback loops',
                'Placement roadmap & interview prep',
              ].map((t) => (
                <div key={t} style={{ padding: 12, borderRadius: 16, background: 'rgba(30,58,138,0.05)', border: `1px solid rgba(30,58,138,0.06)`, color: youvaTheme.colors.text, fontWeight: 950, fontSize: 13 }}>
                  ✓ {t}
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderRadius: 26, background: 'linear-gradient(135deg, rgba(30,58,138,0.08), rgba(63,125,160,0.06))', border: `1px solid ${youvaTheme.colors.borderSoft}`, padding: 18, boxShadow: youvaTheme.shadow.soft }}>
            <div style={{ fontSize: 12, fontWeight: 1000, letterSpacing: '0.08em', color: youvaTheme.colors.brand2, textTransform: 'uppercase' }}>Our Values</div>
            <div style={{ marginTop: 10, fontSize: 24, fontWeight: 1000, color: youvaTheme.colors.text }}>How we build YouVA OS</div>
            <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
              {values.map((v) => (
                <div key={v.title} style={{ borderRadius: 20, background: '#FFFFFF', border: `1px solid ${youvaTheme.colors.borderSoft}`, padding: 14 }}>
                  <div style={{ fontWeight: 1000, color: youvaTheme.colors.text }}>{v.title}</div>
                  <div style={{ marginTop: 8, color: youvaTheme.colors.muted, fontWeight: 850, lineHeight: 1.8, fontSize: 13 }}>{v.body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionShell>

      <SectionShell paddingY={10} paddingBottom={22}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 1000, letterSpacing: '0.08em', color: youvaTheme.colors.accent, textTransform: 'uppercase' }}>Learning Philosophy</div>
            <div style={{ marginTop: 10, fontSize: 36, fontWeight: 1000, color: youvaTheme.colors.text }}>Learn → Build → Prove → Get Ready</div>
          </div>
          <div style={{ color: youvaTheme.colors.muted, fontWeight: 850, lineHeight: 1.9, maxWidth: 560 }}>
            YouVA OS is designed so your effort becomes measurable outcomes—skills, deliverables, certificates, and placement readiness.
          </div>
        </div>

        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 16 }}>
          {philosophy.map((p) => (
            <div key={p.title} style={{ borderRadius: 22, background: '#FFFFFF', border: `1px solid ${youvaTheme.colors.borderSoft}`, padding: 16, boxShadow: youvaTheme.shadow.soft }}>
              <div style={{ width: 46, height: 46, borderRadius: 18, background: 'linear-gradient(135deg, rgba(31,61,99,0.12), rgba(63,125,160,0.14))', border: `1px solid ${youvaTheme.colors.borderSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 1000, color: youvaTheme.colors.text }}>
                ✦
              </div>
              <div style={{ marginTop: 12, fontWeight: 1000, color: youvaTheme.colors.text }}>{p.title}</div>
              <div style={{ marginTop: 8, color: youvaTheme.colors.muted, fontWeight: 850, lineHeight: 1.8, fontSize: 13 }}>{p.body}</div>
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell paddingY={10} paddingBottom={22}>
        <div style={{ fontSize: 12, fontWeight: 1000, letterSpacing: '0.08em', color: youvaTheme.colors.accent, textTransform: 'uppercase' }}>Meet Our Team</div>
        <div style={{ marginTop: 10, fontSize: 36, fontWeight: 1000, color: youvaTheme.colors.text }}>Learning design, mentoring, and execution</div>
        <div style={{ marginTop: 12, color: youvaTheme.colors.muted, fontWeight: 850, lineHeight: 1.9, maxWidth: 820 }}>
          YouVA OS is powered by a team of learning designers, AI mentors, and workshop trainers who build programs around real outcomes.
        </div>

        <div style={{ marginTop: 18 }}>
          <AboutTeamGrid />
        </div>
      </SectionShell>

      <SectionShell paddingY={10} paddingBottom={24}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 1000, letterSpacing: '0.08em', color: youvaTheme.colors.accent, textTransform: 'uppercase' }}>Partner Institutions</div>
            <div style={{ marginTop: 10, fontSize: 36, fontWeight: 1000, color: youvaTheme.colors.text }}>Learning cohorts with real stakeholders</div>
          </div>
          <div style={{ color: youvaTheme.colors.muted, fontWeight: 850, lineHeight: 1.9, maxWidth: 560 }}>
            We collaborate with colleges, universities, and corporate partners to deliver structured AI cohorts with workshops, projects, assessments, and career support.
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <LogoCarousel />
        </div>
      </SectionShell>

      <SectionShell paddingY={10} paddingBottom={90}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 1000, letterSpacing: '0.08em', color: youvaTheme.colors.accent, textTransform: 'uppercase' }}>Journey Timeline</div>
            <div style={{ marginTop: 10, fontSize: 36, fontWeight: 1000, color: youvaTheme.colors.text }}>From discovery to placement readiness</div>
          </div>
          {/* // Sign Up hidden — account creation is not active right now.
          <button
            onClick={() => navigate('/signup')}
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg,#1E3A8A,#2563EB)',
              color: '#fff',
              fontWeight: 1000,
              cursor: 'pointer',
            }}
          >
            Sign Up
          </button>
          */}
        </div>

        <div style={{ marginTop: 18 }}>
          <Timeline steps={journey} />
        </div>
      </SectionShell>
    </div>
  );
}


