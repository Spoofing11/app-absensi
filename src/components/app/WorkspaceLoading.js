import "./workspace.css";
export default function WorkspaceLoading() {
  return (
    <div
      role="status"
      aria-label="Memuat halaman"
      className="workspace-loading"
    >
      <div className="loading-line" />
      <div className="loading-line short" />
      <div className="loading-cards">
        <div />
        <div />
        <div />
      </div>
      <span className="muted">Memuat informasi...</span>
    </div>
  );
}
