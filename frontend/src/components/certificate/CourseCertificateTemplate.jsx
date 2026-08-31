import React from 'react';
import { fmtDateLong } from '../../utils/dateTime';

/**
 * Standard printable certificate — name, course, score, completion date.
 */
export default function CourseCertificateTemplate({
  traineeName = '',
  courseName = '',
  score = null,
  completionDate = null,
  certificateNo = '',
}) {
  const dateLabel = completionDate
    ? fmtDateLong(completionDate)
    : fmtDateLong(new Date().toISOString());

  const showScore = score != null && score !== '';

  return (
    <div
      className="course-certificate-template"
      style={{
        width: '1000px',
        maxWidth: '100%',
        minHeight: '700px',
        margin: '0 auto',
        padding: '14px',
        background: 'linear-gradient(135deg, #c9a227 0%, #e8d48b 35%, #c9a227 70%, #a67c00 100%)',
        boxSizing: 'border-box',
        fontFamily: "'Georgia', 'Times New Roman', serif",
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      {/* Inner frame */}
      <div
        style={{
          border: '2px solid #1e3a5f',
          background: '#fffef8',
          minHeight: '672px',
          padding: '48px 56px 40px',
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Corner ornaments */}
        {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((pos) => {
          const isTop = pos.includes('top');
          const isLeft = pos.includes('left');
          return (
            <div
              key={pos}
              style={{
                position: 'absolute',
                width: 72,
                height: 72,
                [isTop ? 'top' : 'bottom']: 18,
                [isLeft ? 'left' : 'right']: 18,
                borderTop: isTop ? '3px solid #c9a227' : 'none',
                borderBottom: !isTop ? '3px solid #c9a227' : 'none',
                borderLeft: isLeft ? '3px solid #c9a227' : 'none',
                borderRight: !isLeft ? '3px solid #c9a227' : 'none',
                opacity: 0.85,
              }}
            />
          );
        })}

        {/* Watermark */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            opacity: 0.04,
            fontSize: 120,
            fontWeight: 700,
            color: '#1e3a5f',
            letterSpacing: 8,
            userSelect: 'none',
          }}
        >
          YOUNOVATE
        </div>

        {/* Header */}
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 64,
              height: 64,
              borderRadius: '50%',
              border: '3px solid #c9a227',
              background: 'linear-gradient(145deg, #1e3a5f 0%, #2d5280 100%)',
              marginBottom: 16,
              boxShadow: '0 4px 14px rgba(30,58,95,.25)',
            }}
          >
            <span style={{ fontSize: 28, lineHeight: 1 }}>🏅</span>
          </div>

          <p
            style={{
              margin: '0 0 6px',
              fontSize: 13,
              letterSpacing: 6,
              textTransform: 'uppercase',
              color: '#64748b',
              fontFamily: "'Inter', system-ui, sans-serif",
              fontWeight: 600,
            }}
          >
            Younovate Learning Management System
          </p>

          <h1
            style={{
              margin: '0 0 8px',
              fontSize: 42,
              fontWeight: 700,
              color: '#1e3a5f',
              letterSpacing: 2,
              lineHeight: 1.15,
            }}
          >
            Certificate of Completion
          </h1>

          <div
            style={{
              width: 280,
              height: 3,
              margin: '0 auto 32px',
              background: 'linear-gradient(90deg, transparent, #c9a227, #e8d48b, #c9a227, transparent)',
            }}
          />

          <p
            style={{
              margin: '0 0 10px',
              fontSize: 17,
              color: '#475569',
              fontStyle: 'italic',
            }}
          >
            This is to certify that
          </p>

          <p
            style={{
              margin: '0 0 12px',
              fontSize: 38,
              fontWeight: 700,
              color: '#0f172a',
              lineHeight: 1.25,
              borderBottom: '2px solid #c9a227',
              display: 'inline-block',
              paddingBottom: 6,
              minWidth: 320,
            }}
          >
            {traineeName || 'Trainee'}
          </p>

          <p style={{ margin: '20px 0 8px', fontSize: 17, color: '#475569' }}>
            has successfully completed the workshop / course
          </p>

          <p
            style={{
              margin: '0 0 20px',
              fontSize: 26,
              fontWeight: 700,
              color: '#1e3a5f',
              lineHeight: 1.35,
              maxWidth: 720,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            {courseName || 'Course'}
          </p>

          {showScore && (
            <div
              style={{
                display: 'inline-block',
                marginBottom: 28,
                padding: '10px 28px',
                border: '1px solid #e2e8f0',
                borderRadius: 999,
                background: 'linear-gradient(180deg, #f8fafc 0%, #fff 100%)',
              }}
            >
              <span style={{ fontSize: 14, color: '#64748b', fontFamily: "'Inter', system-ui, sans-serif" }}>
                Achievement Score:{' '}
              </span>
              <strong style={{ fontSize: 22, color: '#b45309', letterSpacing: 0.5 }}>{score}%</strong>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 24,
            alignItems: 'end',
            marginTop: showScore ? 8 : 36,
            paddingTop: 28,
            borderTop: '1px solid #e2e8f0',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: '#1e3a5f',
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              {dateLabel}
            </div>
            <div
              style={{
                marginTop: 8,
                borderTop: '1px solid #94a3b8',
                paddingTop: 6,
                fontSize: 11,
                color: '#64748b',
                letterSpacing: 1,
                textTransform: 'uppercase',
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              Date of Issue
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 72,
                height: 72,
                margin: '0 auto 4px',
                borderRadius: '50%',
                border: '2px double #c9a227',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'radial-gradient(circle at 30% 30%, #fffef8, #f1f5f9)',
                fontSize: 11,
                fontWeight: 700,
                color: '#1e3a5f',
                lineHeight: 1.2,
                textAlign: 'center',
                padding: 8,
              }}
            >
              OFFICIAL<br />SEAL
            </div>
            {certificateNo && (
              <div
                style={{
                  fontSize: 10,
                  color: '#94a3b8',
                  fontFamily: 'monospace',
                  marginTop: 4,
                }}
              >
                {certificateNo}
              </div>
            )}
          </div>

          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: "'Brush Script MT', 'Segoe Script', cursive",
                fontSize: 28,
                color: '#1e3a5f',
                marginBottom: 2,
                minHeight: 36,
              }}
            >
              Younovate
            </div>
            <div
              style={{
                borderTop: '1px solid #94a3b8',
                paddingTop: 6,
                fontSize: 11,
                color: '#64748b',
                letterSpacing: 1,
                textTransform: 'uppercase',
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              Authorized Signature
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
