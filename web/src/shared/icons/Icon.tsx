import type { ReactNode } from "react";

/**
 * Generic inline svg frame shared by the app shells.
 *
 * Both legacy icon sets bake their own markup (see `admin/icons.tsx` and
 * `site/icons.tsx`) so they can stay byte-faithful to the hand-written originals.
 * This frame exists for one-off glyphs owned by shared UI (chevrons, spinners…):
 * pass the path data as children. `name` is echoed as `data-icon` so tests and QA
 * can tell which glyph rendered.
 */
export type IconProps = {
  name: string;
  size?: number;
  className?: string;
  stroke?: number;
  children?: ReactNode;
};

export function Icon({ name, size = 18, className = "icon", stroke = 1.7, children }: IconProps): JSX.Element {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-icon={name}
    >
      {children}
    </svg>
  );
}
