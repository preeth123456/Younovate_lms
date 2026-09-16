import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const PROGRAM_META = {
  YIEP: { icon: '⚡', color: '#2563EB', glow: 'rgba(37,99,235,0.4)', gradient: 'linear-gradient(135deg, #1E3A8A, #2563EB)' },
  YBLP: { icon: '🚀', color: '#7C3AED', glow: 'rgba(124,58,237,0.4)', gradient: 'linear-gradient(135deg, #4C1D95, #7C3AED)' },
};

function ProgramCard({ program }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef(null);
  const meta = PROGRAM_META[program.name] || PROGRAM_META.YIEP;

  const handleMouseMove = (e) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 10;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -10;
    setTilt({ x, y });
  };

  return (
    <div
      ref={cardRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setTilt({ x: 0, y: 0 }); }}
      onMouseMove={handleMouseMove}
      style={{
        borderRadius: 24,
        background: hovered ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${hovered ? meta.color + '60' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: hovered
          ? `0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px ${meta.color}30, inset 0 1px 0 rgba(255,255,255,0.1)`
          : '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
        padding: 24,
        transform: hovered
          ? `perspective(1000px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg) translateY(-8px)`
          : 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)',
        transition: 'all 0.35s ease',
        backdropFilter: 'blur(16px)',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Animated gradient border top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: meta.gradient,
        opacity: hovered ? 1 : 0.4,
        transition: 'opacity 0.3s',
      }} />

      {/* Background glow */}
      {hovered && (
        <div style={{
          position: 'absolute', top: -40, right: -40,
          width: 200, height: 200, borderRadius: '50%',
          background: `radial-gradient(circle, ${meta.glow} 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ flex: 1 }}>
          {/* Icon + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 16,
              background: meta.gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24,
              boxShadow: `0 8px 24px ${meta.glow}`,
              animation: hovered ? 'icon-bounce 0.5s ease' : 'none',
            }}>
              {meta.icon}
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.02em' }}>
                {program.name}
              </div>
              <div style={{ fontSize: 12, color: meta.color, fontWeight: 700, marginTop: 2 }}>
                {program.certificate}
              </div>
            </div>
          </div>

          <p style={{ color: '#94A3B8', fontSize: 14, lineHeight: 1.7, fontWeight: 500, marginBottom: 16 }}>
            {program.overview}
          </p>

          {/* Pills */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {program.pills.map((p) => (
              <span key={p.label} style={{
                padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                background: p.kind === 'accent' ? 'rgba(37,99,235,0.08)'
                  : p.kind === 'teal' ? 'rgba(6,182,212,0.12)'
                  : 'rgba(37,99,235,0.12)',
                border: `1px solid ${p.kind === 'accent' ? 'rgba(124,58,237,0.3)'
                  : p.kind === 'teal' ? 'rgba(6,182,212,0.3)'
                  : 'rgba(37,99,235,0.3)'}`,
                color: p.kind === 'accent' ? '#A78BFA' : p.kind === 'teal' ? '#22D3EE' : '#60A5FA',
              }}>
                {p.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
        {program.stats.map((s) => (
          <div key={s.label} style={{
            borderRadius: 14, padding: '12px 14px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {s.label}
            </div>
            <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color: '#CBD5E1' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div style={{ display: 'flex', gap: 10 }}>
        {/* // Sign Up hidden — account creation is not active right now.
        <button onClick={() => navigate('/signup')} style={{
          flex: 1, padding: '12px 16px', borderRadius: 12, border: 'none',
          background: meta.gradient, color: '#fff', fontWeight: 700, fontSize: 14,
          cursor: 'pointer', boxShadow: `0 4px 20px ${meta.glow}`,
          transition: 'all 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 8px 28px ${meta.glow}`; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 20px ${meta.glow}`; }}
        >
          Enroll Now
        </button>
        */}
        <button onClick={() => navigate('/programs')} style={{
          flex: 1, padding: '12px 16px', borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.04)', color: '#CBD5E1', fontWeight: 700, fontSize: 14,
          cursor: 'pointer', transition: 'all 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#F1F5F9'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#CBD5E1'; }}
        >
          Learn More
        </button>
      </div>

      <style>{`@keyframes icon-bounce { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }`}</style>
    </div>
  );
}

export default function ProgramCards({ programs }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 20 }}>
      {programs.map((p) => <ProgramCard key={p.key} program={p} />)}
    </div>
  );
}
