/* Minimal stroke icon set (24x24, currentColor). */
function Svg({ size = 18, children, fill = 'none', ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconPlay = (p) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <path d="M7 4.5v15a1 1 0 0 0 1.52.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5z" />
  </Svg>
);
export const IconPause = (p) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <rect x="6" y="4" width="4" height="16" rx="1.2" />
    <rect x="14" y="4" width="4" height="16" rx="1.2" />
  </Svg>
);
export const IconBack10 = (p) => (
  <Svg {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
    <text x="12" y="15.5" fontSize="7.5" fontWeight="700" textAnchor="middle" fill="currentColor" stroke="none">
      10
    </text>
  </Svg>
);
export const IconFwd10 = (p) => (
  <Svg {...p}>
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 4v5h-5" />
    <text x="12" y="15.5" fontSize="7.5" fontWeight="700" textAnchor="middle" fill="currentColor" stroke="none">
      10
    </text>
  </Svg>
);
export const IconVolume = (p) => (
  <Svg {...p}>
    <path d="M11 5 6 9H2v6h4l5 4V5z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    <path d="M19 5a10 10 0 0 1 0 14" />
  </Svg>
);
export const IconVolumeLow = (p) => (
  <Svg {...p}>
    <path d="M11 5 6 9H2v6h4l5 4V5z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
  </Svg>
);
export const IconMute = (p) => (
  <Svg {...p}>
    <path d="M11 5 6 9H2v6h4l5 4V5z" />
    <path d="m22 9-6 6M16 9l6 6" />
  </Svg>
);
export const IconFullscreen = (p) => (
  <Svg {...p}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
  </Svg>
);
export const IconExitFullscreen = (p) => (
  <Svg {...p}>
    <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
  </Svg>
);
export const IconMic = (p) => (
  <Svg {...p}>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8" />
  </Svg>
);
export const IconMicOff = (p) => (
  <Svg {...p}>
    <path d="m2 2 20 20" />
    <path d="M9 9v2a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6" />
    <path d="M17 16.95A7 7 0 0 1 5 11v-1M19 10v1a7 7 0 0 1-.11 1.23M12 18v4M8 22h8" />
  </Svg>
);
export const IconCam = (p) => (
  <Svg {...p}>
    <path d="m22 8-6 4 6 4V8z" />
    <rect x="2" y="6" width="14" height="12" rx="2" />
  </Svg>
);
export const IconCamOff = (p) => (
  <Svg {...p}>
    <path d="m2 2 20 20" />
    <path d="M16 16v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L22 8v8" />
  </Svg>
);
export const IconCopy = (p) => (
  <Svg {...p}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Svg>
);
export const IconCheck = (p) => (
  <Svg {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
);
export const IconLink = (p) => (
  <Svg {...p}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </Svg>
);
export const IconFilm = (p) => (
  <Svg {...p}>
    <rect x="2" y="3" width="20" height="18" rx="2" />
    <path d="M7 3v18M17 3v18M2 8h5M2 16h5M17 8h5M17 16h5M2 12h20" />
  </Svg>
);
export const IconUpload = (p) => (
  <Svg {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m17 8-5-5-5 5M12 3v12" />
  </Svg>
);
export const IconSend = (p) => (
  <Svg {...p}>
    <path d="m22 2-7 20-4-9-9-4 20-7z" />
    <path d="M22 2 11 13" />
  </Svg>
);
export const IconLogOut = (p) => (
  <Svg {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </Svg>
);
export const IconChat = (p) => (
  <Svg {...p}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Svg>
);
export const IconChevron = (p) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);
export const IconAlert = (p) => (
  <Svg {...p}>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <path d="M12 9v4M12 17h.01" />
  </Svg>
);
export const IconUsers = (p) => (
  <Svg {...p}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </Svg>
);
export const IconSwap = (p) => (
  <Svg {...p}>
    <path d="M17 1l4 4-4 4" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </Svg>
);
export const IconX = (p) => (
  <Svg {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Svg>
);
