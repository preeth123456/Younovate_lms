import React from 'react';
import { useNavigate } from 'react-router-dom';
import { youvaCTA, youvaTheme } from './youvaTokens';

export default function CtaBar({ headline = 'Ready to Start Your AI Journey?' }) {
  const navigate = useNavigate();

  return (
    <div style={{
      borderRadius: 26,
      background:
        'radial-gradient(circle at 15% 20%, rgba(124,58,237,0.18), transparent 38%), radial-gradient(circle at 85% 10%, rgba(63,125,160,0.22), transparent 42%), linear-gradient(135deg, rgba(30,58,138,0.08), rgba(37,99,235,0.08))',
      border: `1px solid rgba(219,227,237,0.9)`,
      boxShadow: '0 30px 100px rgba(30,58,138,0.06)',
      padding: 20,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      flexWrap: 'wrap',
    }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 1000, letterSpacing: '0.08em', color: youvaTheme.colors.accent, textTransform: 'uppercase' }}>
          Next Generation LMS + Workshops
        </div>
        <div style={{ marginTop: 8, fontSize: 30, fontWeight: 1000, color: youvaTheme.colors.text, lineHeight: 1.15 }}>
          {headline}
        </div>
        <div style={{ marginTop: 10, color: youvaTheme.colors.muted, fontWeight: 850, lineHeight: 1.8 }}>
          Choose YIEP or YBLP, join live AI Workshops, build projects, and get certified with placement support.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {/* // Sign Up hidden — account creation is not active right now.
        <button
          onClick={() => navigate('/signup')}
          style={youvaCTA.primaryStyle}
        >
          Sign Up
        </button>
        */}
        <button
          onClick={() => navigate('/workshops')}
          style={youvaCTA.secondaryStyle}
        >
          Explore Workshops
        </button>
      </div>
    </div>
  );
}

