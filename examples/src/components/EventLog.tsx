import { useEffect, type ReactElement } from 'react';
import { REWARDED_EVENTS } from '@ezoic/react-sdk';
import { useEventLog } from '../eventLog';

/**
 * Fixed side panel that renders the shared event log, newest first. On mount it
 * subscribes to the three rewarded-ad window events and logs each; the listeners
 * are removed on unmount.
 */
export function EventLog(): ReactElement {
  const { entries, log } = useEventLog();

  useEffect(() => {
    const onInitiated = (): void => log(`window event: ${REWARDED_EVENTS.INITIATED}`);
    const onDisplayed = (): void => log(`window event: ${REWARDED_EVENTS.DISPLAYED}`);
    const onClosed = (): void => log(`window event: ${REWARDED_EVENTS.CLOSED}`);

    window.addEventListener(REWARDED_EVENTS.INITIATED, onInitiated);
    window.addEventListener(REWARDED_EVENTS.DISPLAYED, onDisplayed);
    window.addEventListener(REWARDED_EVENTS.CLOSED, onClosed);

    return () => {
      window.removeEventListener(REWARDED_EVENTS.INITIATED, onInitiated);
      window.removeEventListener(REWARDED_EVENTS.DISPLAYED, onDisplayed);
      window.removeEventListener(REWARDED_EVENTS.CLOSED, onClosed);
    };
  }, [log]);

  return (
    <aside className="event-log">
      <h2 className="event-log-title">Event Log</h2>
      {entries.length === 0 ? (
        <p className="event-log-empty">No events yet — interact with a section.</p>
      ) : (
        <ol className="event-log-list">
          {entries.map((entry) => (
            <li className="event-log-item" key={entry.id}>
              <span className="event-log-time">{entry.time}</span>
              <span className="event-log-msg">{entry.msg}</span>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
