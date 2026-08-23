import {icons} from '../generated/icons';

export interface IconProps {
  name: keyof typeof icons;
  size?: number;
  className?: string;
}

export function Icon({name, size = 24, className}: IconProps) {
  const svg = icons[name];
  return (
    <span
      className={className}
      style={{fontSize: size, lineHeight: 1, display: 'inline-flex'}}
      dangerouslySetInnerHTML={{__html: svg}}
    />
  );
}
