import React from 'react';
import { motion } from 'framer-motion';

import { youvaTheme } from './youvaTokens';

export default function RobotTeacherSVG() {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 2 }} aria-hidden>
      {/* Neural network background within scene */}
      <svg
        viewBox="0 0 800 800"
        width="100%"
        height="100%"
        style={{ position: 'absolute', inset: 0, opacity: 0.9, pointerEvents: 'none' }}
      >
        <defs>
          <linearGradient id="nnGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={youvaTheme.colors.brand2} stopOpacity="0.8" />
            <stop offset="55%" stopColor={youvaTheme.colors.cyan} stopOpacity="0.35" />
            <stop offset="100%" stopColor={youvaTheme.colors.accent} stopOpacity="0.55" />
          </linearGradient>
          <filter id="nnGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Animated particles (SVG circles) */}
        {Array.from({ length: 28 }).map((_, i) => {
          const x = 120 + (i * 22) % 560;
          const y = 140 + (i * 37) % 540;
          const delay = i * 0.12;
          return (
            <circle key={i} cx={x} cy={y} r="1.8" fill="url(#nnGrad)" opacity="0.55" filter="url(#nnGlow)" >
              <animate attributeName="cy" values={`${y};${y - 16};${y}`} dur={`${2.8 + (i % 6) * 0.25}s`} begin={`${delay}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.15;0.7;0.15" dur={`${2.8 + (i % 6) * 0.25}s`} begin={`${delay}s`} repeatCount="indefinite" />
            </circle>
          );
        })}

        {/* Neural lines */}
        <g filter="url(#nnGlow)" opacity="0.55">
          {[
            [180, 260, 350, 300],
            [350, 300, 510, 260],
            [260, 430, 400, 380],
            [400, 380, 540, 430],
            [210, 560, 360, 500],
            [360, 500, 560, 540],
            [240, 320, 460, 470],
            [280, 410, 520, 350],
          ].map((l, idx) => (
            <line
              key={idx}
              x1={l[0]}
              y1={l[1]}
              x2={l[2]}
              y2={l[3]}
              stroke="url(#nnGrad)"
              strokeWidth="1.3"
              strokeLinecap="round"
              opacity="0.6"
            >
              <animate attributeName="opacity" values="0.15;0.75;0.15" dur={`${2.5 + idx * 0.2}s`} repeatCount="indefinite" />
            </line>
          ))}
        </g>
      </svg>

      {/* Students (3) */}
      <svg viewBox="0 0 800 800" width="100%" height="100%" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <g opacity="0.95">
          {[0, 1, 2].map((s, i) => {
            const baseX = 270 + i * 170;
            const baseY = 600 + (i === 1 ? 8 : 0);
            const hue = i === 0 ? youvaTheme.colors.brand2 : i === 1 ? youvaTheme.colors.cyan : youvaTheme.colors.accent;
            return (
              <g key={s} transform={`translate(${baseX}, ${baseY})`}>
                <motion.g
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.35 + i * 0.12 }}
                >
                  <circle cx="0" cy="-40" r="26" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.14)" />
                  <circle cx="-10" cy="-48" r="6" fill={hue} opacity="0.7">
                    <animate attributeName="opacity" values="0.25;0.9;0.25" dur={`${1.6 + i * 0.2}s`} repeatCount="indefinite" />
                  </circle>
                  <circle cx="10" cy="-48" r="6" fill={hue} opacity="0.7">
                    <animate attributeName="opacity" values="0.25;0.9;0.25" dur={`${1.7 + i * 0.18}s`} repeatCount="indefinite" />
                  </circle>
                  <rect x="-42" y="-22" width="84" height="56" rx="22" fill="rgba(15,23,42,0.7)" stroke="rgba(255,255,255,0.12)" />
                  <path
                    d="M -28 24 Q 0 8 28 24"
                    stroke={hue}
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                    opacity="0.7"
                  >
                    <animate attributeName="opacity" values="0.15;0.85;0.15" dur={`${2.6 + i * 0.3}s`} repeatCount="indefinite" />
                  </path>
                </motion.g>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Holographic board */}
      <div style={{ position: 'absolute', left: '50%', top: 210, transform: 'translateX(-50%)', width: '56%', maxWidth: 420 }}>
        <svg viewBox="0 0 420 220" width="100%" style={{ display: 'block', height: 'auto', filter: 'drop-shadow(0 0 18px rgba(37,99,235,0.35))' }}>
          <defs>
            <linearGradient id="boardGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={youvaTheme.colors.brand2} stopOpacity="0.35" />
              <stop offset="55%" stopColor={youvaTheme.colors.cyan} stopOpacity="0.18" />
              <stop offset="100%" stopColor={youvaTheme.colors.accent} stopOpacity="0.25" />
            </linearGradient>
          </defs>

          <rect x="30" y="18" width="360" height="170" rx="18" fill="rgba(6,182,212,0.03)" stroke="rgba(37,99,235,0.22)" strokeDasharray="6 4" />
          <rect x="50" y="36" width="320" height="40" rx="12" fill="rgba(255,255,255,0.04)" stroke="rgba(124,58,237,0.22)" />

          <g opacity="0.9">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <rect
                key={i}
                x={70 + i * 52}
                y={90 + (i % 2) * 10}
                width="34"
                height="10"
                rx="6"
                fill={i % 3 === 0 ? youvaTheme.colors.cyan : i % 3 === 1 ? youvaTheme.colors.brand2 : youvaTheme.colors.accent}
                opacity="0.55"
              >
                <animate attributeName="opacity" values="0.2;0.9;0.2" dur={`${2.4 + i * 0.18}s`} repeatCount="indefinite" />
              </rect>
            ))}
          </g>

          {/* Scanlines */}
          <g opacity="0.35">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <line key={i} x1={40} y1={65 + i * 22} x2={380} y2={65 + i * 22} stroke="rgba(37,99,235,0.45)" strokeWidth="1" strokeDasharray="3 4" >
                <animate attributeName="opacity" values="0.1;0.6;0.1" dur={`${2.1 + i * 0.15}s`} repeatCount="indefinite" />
              </line>
            ))}
          </g>

          {/* Holo cursor */}
          <g>
            <rect x="72" y="150" width="90" height="14" rx="8" fill="rgba(37,99,235,0.12)" stroke="rgba(37,99,235,0.28)" />
            <rect x="72" y="150" width="38" height="14" rx="8" fill="rgba(6,182,212,0.25)" >
              <animate attributeName="width" values="18;62;18" dur="2.6s" repeatCount="indefinite" />
            </rect>
          </g>
        </svg>
      </div>

      {/* Robot (simplified, cinematic) */}
      <div style={{ position: 'absolute', left: '50%', top: 150, transform: 'translateX(-50%)', width: '54%', maxWidth: 340 }}>
        <svg viewBox="0 0 280 420" width="100%" style={{ display: 'block', height: 'auto' }}>
          <defs>
            <linearGradient id="rBody" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={youvaTheme.colors.brand2} stopOpacity="0.55" />
              <stop offset="50%" stopColor="#1E293B" stopOpacity="0.8" />
              <stop offset="100%" stopColor={youvaTheme.colors.accent} stopOpacity="0.35" />
            </linearGradient>
            <linearGradient id="rHead" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={youvaTheme.colors.cyan} stopOpacity="0.55" />
              <stop offset="100%" stopColor={youvaTheme.colors.brand2} stopOpacity="0.55" />
            </linearGradient>
            <filter id="rGlow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Body */}
          <rect x="64" y="150" width="152" height="160" rx="24" fill="url(#rBody)" stroke="rgba(37,99,235,0.35)" strokeWidth="1.5" />
          <rect x="104" y="172" width="72" height="34" rx="14" fill="rgba(255,255,255,0.04)" stroke="rgba(124,58,237,0.25)" />

          {/* Chest hologram */}
          <circle cx="140" cy="238" r="34" fill="rgba(37,99,235,0.08)" stroke="rgba(37,99,235,0.28)" />
          <circle cx="140" cy="238" r="18" fill="rgba(6,182,212,0.12)" filter="url(#rGlow)">
            <animate attributeName="r" values="16;22;16" dur="2.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0.95;0.5" dur="2.2s" repeatCount="indefinite" />
          </circle>

          {/* Arms */}
          <g id="armL" style={{ transformOrigin: '70px 250px' }}>
            <animateTransform attributeName="transform" type="rotate" values="0 70 250;-6 70 250;0 70 250" dur="1.9s" repeatCount="indefinite" />
            <rect x="26" y="172" width="44" height="120" rx="18" fill="rgba(30,41,59,0.75)" stroke="rgba(37,99,235,0.25)" />
            <rect x="32" y="268" width="32" height="32" rx="14" fill="rgba(255,255,255,0.04)" stroke="rgba(6,182,212,0.30)" />
          </g>
          <g id="armR" style={{ transformOrigin: '210px 250px' }}>
            <animateTransform attributeName="transform" type="rotate" values="0 210 250;8 210 250;0 210 250" dur="2.2s" repeatCount="indefinite" />
            <rect x="210" y="172" width="44" height="120" rx="18" fill="rgba(30,41,59,0.75)" stroke="rgba(37,99,235,0.25)" />
            <rect x="216" y="268" width="32" height="32" rx="14" fill="rgba(255,255,255,0.04)" stroke="rgba(124,58,237,0.30)" />
          </g>

          {/* Head group with animations */}
          <g id="head" style={{ transformOrigin: '140px 94px' }}>
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="0 140 94;3 140 94;0 140 94;-3 140 94;0 140 94"
              dur="4.2s"
              repeatCount="indefinite"
            />

            <rect x="78" y="28" width="124" height="92" rx="26" fill="url(#rHead)" stroke="rgba(37,99,235,0.35)" />
            <rect x="96" y="48" width="88" height="32" rx="14" fill="rgba(15,23,42,0.55)" stroke="rgba(6,182,212,0.25)" />

            {/* Eyes */}
            <g id="eyes">
              <ellipse cx="118" cy="64" rx="14" ry="10" fill="rgba(6,182,212,0.14)" stroke="rgba(6,182,212,0.45)" />
              <ellipse cx="162" cy="64" rx="14" ry="10" fill="rgba(6,182,212,0.14)" stroke="rgba(6,182,212,0.45)" />

              <ellipse cx="118" cy="64" rx="6" ry="6" fill={youvaTheme.colors.cyan} filter="url(#rGlow)">
                <animate attributeName="ry" values="6;1;6" dur="3.4s" repeatCount="indefinite" />
              </ellipse>
              <ellipse cx="162" cy="64" rx="6" ry="6" fill={youvaTheme.colors.brand2} filter="url(#rGlow)">
                <animate attributeName="ry" values="6;1;6" dur="3.8s" begin="0.2s" repeatCount="indefinite" />
              </ellipse>

              {/* Blink highlight */}
              <rect x="98" y="58" width="84" height="12" rx="6" fill="rgba(124,58,237,0.08)" opacity="0.8">
                <animate attributeName="opacity" values="0.2;0.9;0.2" dur="5s" repeatCount="indefinite" />
              </rect>
            </g>

            {/* Mouth speaker */}
            <rect x="110" y="78" width="60" height="10" rx="5" fill="rgba(37,99,235,0.12)" stroke="rgba(37,99,235,0.25)" />
            {[0, 1, 2, 3, 4, 5].map((k) => (
              <rect key={k} x={116 + k * 8} y="80" width="4" height="4" rx="2" fill={k % 2 ? youvaTheme.colors.cyan : youvaTheme.colors.accent} opacity="0.7">
                <animate attributeName="height" values="2;8;2" dur={`${1.4 + k * 0.1}s`} repeatCount="indefinite" />
              </rect>
            ))}

            {/* Antenna */}
            <line x1="140" y1="20" x2="140" y2="6" stroke="rgba(124,58,237,0.6)" strokeWidth="2" />
            <circle cx="140" cy="4" r="6" fill={youvaTheme.colors.accent} opacity="0.6" filter="url(#rGlow)">
              <animate attributeName="opacity" values="0.25;0.95;0.25" dur="1.6s" repeatCount="indefinite" />
            </circle>
          </g>

          {/* Ground hologram */} 
          <ellipse cx="140" cy="392" rx="92" ry="18" fill="rgba(37,99,235,0.08)" stroke="rgba(37,99,235,0.20)" strokeDasharray="5 4" filter="url(#rGlow)" >
            <animate attributeName="opacity" values="0.25;0.85;0.25" dur="2.6s" repeatCount="indefinite" />
          </ellipse>
        </svg>
      </div>

      {/* Gesture beam to board */}
      <div style={{ position: 'absolute', left: '50%', top: 300, transform: 'translateX(-50%)', width: '36%', height: 120, pointerEvents: 'none' }}>
        <svg viewBox="0 0 420 160" width="100%" height="100%">
          <defs>
            <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={youvaTheme.colors.brand2} stopOpacity="0" />
              <stop offset="40%" stopColor={youvaTheme.colors.cyan} stopOpacity="0.55" />
              <stop offset="70%" stopColor={youvaTheme.colors.accent} stopOpacity="0.5" />
              <stop offset="100%" stopColor={youvaTheme.colors.brand2} stopOpacity="0" />
            </linearGradient>
            <filter id="beamGlow">
              <feGaussianBlur stdDeviation="6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path d="M60 110 C160 70, 240 60, 340 30" stroke="url(#beam)" strokeWidth="4" fill="none" strokeLinecap="round" filter="url(#beamGlow)" opacity="0.9">
            <animate attributeName="stroke-dashoffset" from="0" to="-120" dur="1.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.15;0.95;0.15" dur="2.4s" repeatCount="indefinite" />
          </path>
          <path d="M60 110 C160 70, 240 60, 340 30" stroke="url(#beam)" strokeWidth="1.5" strokeDasharray="6 8" fill="none" strokeLinecap="round" opacity="0.9" />
        </svg>
      </div>

      <style>{`
        @media (max-width: 520px) {
          svg { overflow: visible; }
        }
      `}</style>
    </div>
  );
}

