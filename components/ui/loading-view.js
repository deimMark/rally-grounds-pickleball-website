export function LoadingView() {
  return <main id="main-content" className="container loading-view" aria-busy="true" aria-label="Loading Rally Grounds">
    <p role="status">Getting the grounds ready…</p>
    <div className="skeleton skeleton-title" /><div className="skeleton skeleton-panel" />
  </main>;
}
