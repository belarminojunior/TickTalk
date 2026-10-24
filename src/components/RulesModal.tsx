import { useT } from '../i18n';
import { Modal } from './Controls';
import styles from './RulesModal.module.css';

export function RulesModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <Modal title={t.rulesTitle} onClose={onClose}>
      {t.rulesSections.map((s) => (
        <section key={s.title} className={styles.section}>
          <h3>{s.title}</h3>
          <p>{s.body}</p>
        </section>
      ))}
      <section className={styles.section}>
        <h3>{t.shortcuts}</h3>
        <div className={styles.shortcuts}>
          <ShortcutTable title={t.shortcutsDescriber} rows={t.shortcutList.describer} />
          <ShortcutTable title={t.shortcutsTable} rows={t.shortcutList.table} />
        </div>
      </section>
    </Modal>
  );
}

function ShortcutTable({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div>
      <h4 className={styles.subTitle}>{title}</h4>
      <dl className={styles.keys}>
        {rows.map(([key, desc]) => (
          <div key={key} className={styles.keyRow}>
            <dt>
              <kbd>{key}</kbd>
            </dt>
            <dd>{desc}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
