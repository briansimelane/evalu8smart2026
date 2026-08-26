import React, { useId } from 'react';

export interface SteveIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  title?: string;
  /** When true, the body uses currentColor (for team tints) instead of the glossy black gradient. */
  flat?: boolean;
}

const BODY_D =
  'M12 2.3C14.5 2.3 16.1 4.4 16.1 7C16.1 9.6 15.4 11.2 14.6 11.7C14.7 12.4 14.9 12.9 14.9 13.4C17.3 13.9 19.3 16 20.2 19.2C20.6 20.4 20.8 21.4 20.9 22L3.1 22C3.2 21.4 3.4 20.4 3.8 19.2C4.7 16 6.7 13.9 9.1 13.4C9.1 12.9 9.3 12.4 9.4 11.7C8.6 11.2 7.9 9.6 7.9 7C7.9 4.4 9.5 2.3 12 2.3Z';

/** Steve — the game's bust token with two white eyes. Glossy black by default; pass `flat` to tint via currentColor. */
export const SteveIcon: React.FC<SteveIconProps> = ({ size = 24, title = 'Steve', flat = false, ...props }) => {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {!flat && (
        <defs>
          <linearGradient id={id} x1="8" y1="2" x2="16" y2="23" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#2c313b" />
            <stop offset="0.4" stopColor="#14161c" />
            <stop offset="1" stopColor="#050506" />
          </linearGradient>
        </defs>
      )}
      <path fill={flat ? 'currentColor' : `url(#${id})`} d={BODY_D} />
      {!flat && (
        <path
          d="M11 3.1c-1.3.5-2.2 2-2.2 3.7 0 .5.1 1 .2 1.4-.5-.6-.8-1.5-.8-2.5 0-1.6 1.2-3 2.8-2.6Z"
          fill="#fff"
          opacity="0.1"
        />
      )}
      <circle cx="10.4" cy="7.1" r="1.5" fill="#fff" />
      <circle cx="13.6" cy="7.1" r="1.5" fill="#fff" />
    </svg>
  );
};

export default SteveIcon;
