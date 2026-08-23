import {icons} from '../generated/icons';
import {Icon} from './Icon';

export interface ListTileProps {
  icon: keyof typeof icons;
  title: string;
  subtitle?: string;
  trailing?: keyof typeof icons | React.ReactNode;
  onClick?: () => void;
  inputValue?: string;
  onInputChange?: (value: string) => void;
  inputPlaceholder?: string;
  inputReadOnly?: boolean;
  toggleValue?: boolean;
  onToggleChange?: (value: boolean) => void;
}

export function ListTile({
  icon,
  title,
  subtitle,
  trailing,
  onClick,
  inputValue,
  onInputChange,
  inputPlaceholder,
  inputReadOnly,
  toggleValue,
  onToggleChange,
}: ListTileProps) {
  const isInput = inputValue !== undefined;
  const isToggle = toggleValue !== undefined;

  return (
    <button
      className={`list-tile${isInput ? ' list-tile--input' : ''}${isToggle ? ' list-tile--toggle' : ''}`}
      onClick={isInput || isToggle ? undefined : onClick}>
      {isInput ? (
        <div className="list-tile-header" onClick={e => e.stopPropagation()}>
          <span className="list-tile-icon">
            <Icon name={icon} size={22} />
          </span>
          <span className="list-tile-title">{title}</span>
        </div>
      ) : (
        <>
          <span className="list-tile-icon">
            <Icon name={icon} size={22} />
          </span>
          <span className="list-tile-body">
            <span className="list-tile-title">{title}</span>
            {subtitle ? <span className="list-tile-subtitle">{subtitle}</span> : null}
          </span>
        </>
      )}
      {isInput ? (
        <input
          className={`list-tile-input${inputReadOnly ? ' list-tile-input--readonly' : ''}`}
          type="text"
          value={inputValue}
          placeholder={inputPlaceholder}
          readOnly={inputReadOnly}
          onChange={e => onInputChange?.(e.target.value)}
          onClick={e => {
            e.stopPropagation();
            if (inputReadOnly) {
              onClick?.();
            }
          }}
        />
      ) : null}
      {isToggle ? (
        <label className="toggle" onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={toggleValue}
            onChange={e => onToggleChange?.(e.target.checked)}
          />
          <span className="toggle-track">
            <span className="toggle-thumb" />
          </span>
        </label>
      ) : trailing && !isInput ? (
        <span className="list-tile-trailing">
          {typeof trailing === 'string' && trailing in icons ? (
            <Icon name={trailing as keyof typeof icons} size={20} />
          ) : (
            trailing
          )}
        </span>
      ) : null}
    </button>
  );
}
