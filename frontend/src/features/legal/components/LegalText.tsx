import { legalBlocks } from '../util/blocks';
import l from './legal.module.css';

/** A legal page's text, laid out (also the console's preview). */
export function LegalText({ text }: { text: string }) {
  return (
    <div className={l.text}>
      {legalBlocks(text).map((b, i) =>
        b.kind === 'h' ? (
          <h2 key={i}>{b.text}</h2>
        ) : b.kind === 'ul' ? (
          <ul key={i}>
            {b.items.map((it, j) => (
              <li key={j}>{it}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{b.text}</p>
        ),
      )}
    </div>
  );
}
