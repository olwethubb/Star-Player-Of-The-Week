import type { SVGProps } from 'react';

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function IconLock(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" strokeWidth={2} {...base} {...props}>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function IconCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" strokeWidth={3} {...base} {...props}>
      <polyline points="4,13 9,18 20,6" />
    </svg>
  );
}

export function IconWallet(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" strokeWidth={2} {...base} {...props}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16" cy="14.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconTrophy(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={40} height={40} viewBox="0 0 24 24" strokeWidth={1.5} {...base} {...props}>
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H4a3 3 0 0 0 3 3" />
      <path d="M17 5h3a3 3 0 0 1-3 3" />
      <path d="M9 17h6" />
      <path d="M12 13v4" />
      <path d="M9 21h6" />
    </svg>
  );
}

export function IconEye(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" strokeWidth={2} {...base} {...props}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconUsers(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" strokeWidth={2} {...base} {...props}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16.5 5.5a3.5 3.5 0 0 1 0 6.9" />
      <path d="M21.5 20a5.5 5.5 0 0 0-4.5-6.3" />
    </svg>
  );
}

export function IconVolume(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" strokeWidth={2} {...base} {...props}>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="M17 8a5 5 0 0 1 0 8" />
      <path d="M19.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

export function IconVolumeOff(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" strokeWidth={2} {...base} {...props}>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="M17 9l5 6" />
      <path d="M22 9l-5 6" />
    </svg>
  );
}

export function IconEyeOff(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" strokeWidth={2} {...base} {...props}>
      <path d="M2 12s3.6-7 10-7c1.9 0 3.5.5 4.8 1.2M22 12s-3.6 7-10 7c-1.9 0-3.5-.5-4.8-1.2" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M3 3l18 18" />
    </svg>
  );
}
