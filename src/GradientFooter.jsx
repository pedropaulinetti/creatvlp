import React, { useId } from "react";

const VBW = 1271;
const VBH = 599;
const stops = [
  { offset: 0, color: "#007BB8" },
  { offset: 0.2, color: "#08A6D9" },
  { offset: 0.42, color: "#76D7E9" },
  { offset: 0.61, color: "#D7F7F4" },
  { offset: 0.76, color: "#D9FF58" },
  { offset: 1, color: "#F5F5F700" },
];

function bellHeights(n, peak, valley) {
  const mid = (n - 1) / 2;
  return Array.from({ length: n }, (_, i) => {
    const distance = mid === 0 ? 0 : Math.abs(i - mid) / mid;
    return peak * VBH * (valley + (1 - valley) * (1 - Math.pow(distance, 1.24)));
  });
}

export function GradientFooter({ children }) {
  const uid = useId().replace(/:/g, "");
  const bars = 13;
  const columnWidth = VBW / bars;

  return (
    <footer className="living-footer">
      <div className="footer-content">{children}</div>
      <div className="gradient-band" aria-hidden="true">
        <svg viewBox={`0 0 ${VBW} ${VBH}`} preserveAspectRatio="none" fill="none">
          <defs>
            <linearGradient id={`footer-gradient-${uid}`} x1="0" y1="1" x2="0" y2="0">
              {stops.map((stop, index) => <stop key={index} offset={stop.offset} stopColor={stop.color} />)}
            </linearGradient>
            <filter id={`footer-blur-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="18" />
            </filter>
          </defs>
          {bellHeights(bars, 1, 0.36).map((height, index) => (
            <g key={index} filter={`url(#footer-blur-${uid})`}>
              <rect x={index * columnWidth} y={VBH - height} width={columnWidth * 1.3} height={height} fill={`url(#footer-gradient-${uid})`} />
            </g>
          ))}
        </svg>
      </div>
    </footer>
  );
}
