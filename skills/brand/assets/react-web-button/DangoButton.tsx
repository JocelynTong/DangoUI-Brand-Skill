import { useEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties } from 'react';

/** Scope: text-only Web buttons in DayOneJourney. Source: dangoui 3.6.16
 * src/button/Button.vue + style.scss + platte.ts. No icons/openType/theme API.
 * Shared real DangoUI stylesheet supplies geometry, spinner and palette states.
 */
export type DangoButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'color'> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'text';
  size?: 'mini' | 'small' | 'normal' | 'medium' | 'large';
  color?: 'primary' | 'default'; disabledType?: 'default' | 'temp';
  loading?: boolean; full?: boolean; press?: boolean; pressBackground?: string;
  extStyle?: CSSProperties;
};
export function DangoButton({ variant = 'primary', size = 'normal', color = 'primary', disabledType = 'default', disabled = false, loading = false, full = false, press = false, pressBackground = 'rgba(0, 0, 0, 0.04)', extStyle, className = '', children, onClick, ...rest }: DangoButtonProps) {
  const [isPress, setIsPress] = useState(false);
  const started = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const effectiveType = disabled && disabledType === 'default' && variant === 'primary' ? 'secondary' : variant;
  const effectiveColor = disabled && disabledType === 'default' ? 'default' : color;
  const classes = ['du-button', `du-button--${size}`, `du-button--${effectiveType}`, disabled && `du-button--${effectiveType}-disabled-temp`, loading && 'du-button--loading', full && 'du-button--full', `du-c-${effectiveColor}-bt`, className].filter(Boolean).join(' ');
  const start = () => { if (press && !disabled && !loading) { clearTimeout(timer.current); started.current = Date.now(); setIsPress(true); } };
  const end = () => { timer.current = setTimeout(() => setIsPress(false), Math.max(150 - (Date.now() - started.current), 0)); };
  return <button {...rest} type="button" className={classes} style={extStyle} data-adapter="dango-button-react" disabled={disabled || loading} aria-busy={loading || undefined}
    onPointerDown={start} onPointerUp={end} onPointerCancel={() => setIsPress(false)} onBlur={() => setIsPress(false)}
    onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') start(); }} onKeyUp={end}
    onClick={e => { if (!disabled && !loading) onClick?.(e); }}>
    {loading && <div aria-hidden="true" className={`du-button__icon du-button__icon--${size} du-button__loading`} />}
    {children}
    {press && isPress && <div aria-hidden="true" className="du-button__press" style={{ background: pressBackground, pointerEvents: 'none' }} />}
  </button>;
}
