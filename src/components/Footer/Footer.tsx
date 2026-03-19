import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span className={styles.brand}>TARDIS</span>
        <span className={styles.copy}>&copy; 2026 TARDIS. All rights reserved.</span>
        <a href="mailto:tardis.ai.com@gmail.com" className={styles.email}>tardis.ai.com@gmail.com</a>
      </div>
    </footer>
  );
}
