import { type ReactElement } from 'react';
import { EzoicProvider, VERSION } from '@ezoic/react-sdk';
import { EventLogProvider } from './eventLog';
import { EventLog } from './components/EventLog';
import { DisplaySection } from './components/DisplaySection';
import { ZeroConfigSection } from './components/ZeroConfigSection';
import { DynamicSection } from './components/DynamicSection';
import { SpaSection } from './components/SpaSection';
import { ConsentSection } from './components/ConsentSection';
import { ImperativeSection } from './components/ImperativeSection';
import { RewardedSection } from './components/RewardedSection';
import { VideoSection } from './components/VideoSection';

/**
 * Wraps the whole demo in a single {@link EzoicProvider} (script management +
 * SDK context) and an {@link EventLogProvider} (shared in-page log), then renders
 * one section per SDK feature plus the fixed event-log panel.
 */
export function App(): ReactElement {
  return (
    <EzoicProvider>
      <EventLogProvider>
        <div className="app">
          <header className="app-header">
            <h1>Ezoic React SDK Demo</h1>
            <p className="app-subtitle">
              Exercises every feature of <code>@ezoic/react-sdk</code> v{VERSION}. The SDK injects
              the CMP and ad scripts at runtime; where Ezoic demand is available the zero-config
              placements below fill. Every control logs to the panel on the right.
            </p>
          </header>
          <main className="app-main">
            <DisplaySection />
            <ZeroConfigSection />
            <DynamicSection />
            <SpaSection />
            <ConsentSection />
            <ImperativeSection />
            <RewardedSection />
            <VideoSection />
          </main>
          <EventLog />
        </div>
      </EventLogProvider>
    </EzoicProvider>
  );
}
