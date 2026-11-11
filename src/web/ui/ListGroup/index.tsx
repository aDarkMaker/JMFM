import type {ReactNode} from 'react';
import styles from './listGroup.module.css';

export interface ListGroupProps {
  /** Small caption above the card. */
  title?: string;
  /** Explanatory line rendered under the card. */
  hint?: string;
  children: ReactNode;
}

/** One settings card: caption, inset rows separated by hairlines, optional hint. */
export function ListGroup({title, hint, children}: ListGroupProps) {
  return (
    <section className={styles.group}>
      {title ? <h2 className={styles.title}>{title}</h2> : null}
      <div className={styles.card}>{children}</div>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </section>
  );
}
