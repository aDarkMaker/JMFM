import {Component, useCallback, useEffect, useState} from 'react';
import type {ReactNode} from 'react';
import {Button} from '@/web/ui/Button';
import {t} from '@/web/i18n';
import styles from './appErrorBoundary.module.css';

interface PanelProps {
  title: string;
  detail?: string;
  onReset: () => void;
}

function ErrorPanel({title, detail, onReset}: PanelProps) {
  return (
    <div className={styles.root} role="alert">
      <span className={styles.title}>{title}</span>
      {detail ? <pre className={styles.detail}>{detail}</pre> : null}
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onReset}>
          {t('error.retry')}
        </Button>
        <Button onClick={() => window.location.reload()}>{t('error.reload')}</Button>
      </div>
    </div>
  );
}

interface InnerProps {
  children: ReactNode;
  onError: (error: Error) => void;
}

class ErrorBoundaryInner extends Component<InnerProps, {failed: boolean}> {
  constructor(props: InnerProps) {
    super(props);
    this.state = {failed: false};
  }

  static getDerivedStateFromError(): {failed: boolean} {
    return {failed: true};
  }

  componentDidCatch(error: Error): void {
    this.props.onError(error);
  }

  render(): ReactNode {
    if (this.state.failed) {
      return null;
    }
    return this.props.children;
  }
}

/** Last-resort UI: render crashes and unhandled rejections never leave a blank screen. */
export function AppErrorBoundary({children}: {children: ReactNode}) {
  const [error, setError] = useState<Error | null>(null);
  const [globalError, setGlobalError] = useState<Error | null>(null);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      setGlobalError(event.error instanceof Error ? event.error : new Error(event.message));
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      setGlobalError(reason instanceof Error ? reason : new Error(String(reason)));
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  const reset = useCallback(() => setError(null), []);

  if (error) {
    return <ErrorPanel title={t('error.crashed')} detail={error.message} onReset={reset} />;
  }

  if (globalError) {
    return (
      <ErrorPanel
        title={t('error.unhandled')}
        detail={globalError.message}
        onReset={() => setGlobalError(null)}
      />
    );
  }

  return <ErrorBoundaryInner onError={setError}>{children}</ErrorBoundaryInner>;
}
