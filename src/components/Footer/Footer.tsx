import Link from 'next/link';
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span className={styles.brand}>TARDIS</span>
        <nav className={styles.links} aria-label="Footer navigation">
          <Link href="/ar-furniture-viewer">AR Furniture Viewer</Link>
          <Link href="/3d-furniture-model-generator">3D Model Generator</Link>
          <Link href="/room-visualizer">Room Visualizer</Link>
        </nav>
        <span className={styles.copy}>&copy; 2026 TARDIS. All rights reserved.</span>
        <a href="mailto:founders@tardis-ai.com" className={styles.email}>founders@tardis-ai.com</a>
      </div>
    </footer>
  );
}
