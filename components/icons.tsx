import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 18, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
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

export const IconPlus = (p: IconProps) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const IconTrash = (p: IconProps) => <Svg {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></Svg>;
export const IconBack = (p: IconProps) => <Svg {...p}><path d="m15 6-6 6 6 6" /></Svg>;
export const IconNext = (p: IconProps) => <Svg {...p}><path d="m9 6 6 6-6 6" /></Svg>;
export const IconCheck = (p: IconProps) => <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>;
export const IconAlert = (p: IconProps) => <Svg {...p}><path d="M12 4 2.5 20h19z" /><path d="M12 10v4M12 17h.01" /></Svg>;
export const IconDown = (p: IconProps) => <Svg {...p}><path d="M7 7l10 10M17 9v8H9" /></Svg>;
export const IconUp = (p: IconProps) => <Svg {...p}><path d="M17 17 7 7M7 15V7h8" /></Svg>;
export const IconMail = (p: IconProps) => <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></Svg>;
export const IconLock = (p: IconProps) => <Svg {...p}><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></Svg>;
export const IconWallet = (p: IconProps) => <Svg {...p}><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" /><rect x="3.5" y="8" width="17" height="11" rx="2" /><path d="M16 13.5h.01" /></Svg>;
export const IconShield = (p: IconProps) => <Svg {...p}><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" /></Svg>;
