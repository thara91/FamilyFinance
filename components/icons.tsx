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
export const IconHome = (p: IconProps) => <Svg {...p}><path d="M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z" /></Svg>;
export const IconList = (p: IconProps) => <Svg {...p}><path d="M8 6h12M8 12h12M8 18h12" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></Svg>;
export const IconTarget = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><path d="M12 12h.01" /></Svg>;
export const IconCamera = (p: IconProps) => <Svg {...p}><path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.5" r="3.5" /></Svg>;
export const IconFile = (p: IconProps) => <Svg {...p}><path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z" /><path d="M14 3v4h4M9 13h6M9 17h4" /></Svg>;
export const IconSearch = (p: IconProps) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></Svg>;
export const IconReceipt = (p: IconProps) => <Svg {...p}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></Svg>;
export const IconLogout = (p: IconProps) => <Svg {...p}><path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5" /><path d="M10 16l-4-4 4-4M6 12h10" /></Svg>;
