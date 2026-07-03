import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

/** A single line in the shared in-page event log. */
export interface EventLogEntry {
  /** Monotonic id, used as the React list key. */
  id: number;
  /** Local wall-clock time the entry was recorded. */
  time: string;
  /** Human-readable message. */
  msg: string;
}

/** Value exposed by {@link useEventLog}. */
interface EventLogContextValue {
  /** Entries, newest first. */
  entries: EventLogEntry[];
  /** Appends a message to the log with the current timestamp. */
  log: (msg: string) => void;
}

const EventLogContext = createContext<EventLogContextValue | null>(null);

let nextEntryId = 0;

/**
 * Provides the shared event log. Each demo section calls {@link useEventLog} to
 * write to it; {@link import('./components/EventLog').EventLog} renders it.
 */
export function EventLogProvider({ children }: { children: ReactNode }): ReactElement {
  const [entries, setEntries] = useState<EventLogEntry[]>([]);

  const log = useCallback((msg: string): void => {
    setEntries((prev) => [
      { id: (nextEntryId += 1), time: new Date().toLocaleTimeString(), msg },
      ...prev,
    ]);
  }, []);

  const value = useMemo<EventLogContextValue>(() => ({ entries, log }), [entries, log]);

  return <EventLogContext.Provider value={value}>{children}</EventLogContext.Provider>;
}

/**
 * Returns the shared event log. Must be called inside an {@link EventLogProvider}.
 *
 * @throws Error when used outside of an `<EventLogProvider>`.
 */
export function useEventLog(): EventLogContextValue {
  const context = useContext(EventLogContext);
  if (context === null) {
    throw new Error('useEventLog must be used within an <EventLogProvider>.');
  }
  return context;
}
