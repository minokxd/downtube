import { LinkBar } from './LinkBar';

export function TitleBar({ showLinkBar }: { showLinkBar: boolean }) {
  return (
    <header className="titlebar">
      <div className="titlebar-brand">
        <span className="logo">downtube</span>
      </div>
      <div className="titlebar-center">{showLinkBar && <LinkBar />}</div>
    </header>
  );
}
