import type { ReactNode, SVGProps } from "react";
import type { AppView } from "../CommandPalette";

const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} satisfies SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      {children}
    </svg>
  );
}

export function IconFocus() {
  return (
    <Svg>
      <circle cx="8" cy="8" r="5.25" />
      <circle cx="8" cy="8" r="1.75" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconInbox() {
  return (
    <Svg>
      <path d="M2.5 4.5h11v7.5H9.25L8 13.5 6.75 12H2.5V4.5z" />
      <path d="M2.5 7.25h11" />
    </Svg>
  );
}

export function IconSubscriptions() {
  return (
    <Svg>
      <path d="M3.5 5.25h9v6.5h-9z" />
      <path d="M5.25 11.75v2" />
      <path d="M10.75 11.75v2" />
      <path d="M3.5 8.25h9" />
    </Svg>
  );
}

export function IconProjects() {
  return (
    <Svg>
      <path d="M2.75 5.25h5.25v5.25H2.75z" />
      <path d="M8 3.5h5.25v5.25H8z" />
      <path d="M8 10.25h5.25v2.25H8z" />
    </Svg>
  );
}

export function IconMeeting() {
  return (
    <Svg>
      <circle cx="5.5" cy="6.25" r="2" />
      <circle cx="10.5" cy="6.25" r="2" />
      <path d="M2.75 13.25c.65-2 1.9-3 2.75-3s2.1 1 2.75 3" />
      <path d="M8.75 13.25c.65-2 1.9-3 2.75-3s2.1 1 2.75 3" />
    </Svg>
  );
}

export function IconSettings() {
  return (
    <Svg>
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1.75v1.5M8 12.75v1.5M1.75 8h1.5M12.75 8h1.5M3.7 3.7l1.06 1.06M11.24 11.24l1.06 1.06M3.7 12.3l1.06-1.06M11.24 4.76l1.06-1.06" />
    </Svg>
  );
}

const NAV_ICONS: Record<AppView, () => ReactNode> = {
  focus: IconFocus,
  inbox: IconInbox,
  subscriptions: IconSubscriptions,
  projects: IconProjects,
  meeting: IconMeeting,
  settings: IconSettings,
};

export function NavViewIcon({ view }: { view: AppView }) {
  const Icon = NAV_ICONS[view];
  return <Icon />;
}
