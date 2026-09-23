export default function IconePlay({ aTocar }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="#fff" aria-hidden="true">
      {aTocar
        ? <><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></>
        : <path d="M8 5v14l11-7z" />}
    </svg>
  );
}
