'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState, type DragEvent } from 'react';

import { isApiError, saveBlob } from '@/lib/api';
import { cn } from '@/lib/utils/cn';

import { csvTemplate, parseCsv } from './csv';
import d from './data.module.css';

export const MAX_IMPORT_ROWS = 5000;
const MAX_BYTES = 2 * 1024 * 1024;

export interface ImportColumn {
  name: string;
  required?: boolean;
  hint?: string;
}

/** The API's answer to an import, checked (`dryRun`) or done. `line` is the spreadsheet row. */
export interface ImportReport {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { line: number; field?: string | null; message: string }[];
  applied: boolean;
}

export type ImportRun = (
  rows: Record<string, string>[],
  opts: { dryRun: boolean; skipInvalid: boolean },
) => Promise<ImportReport>;

type Step =
  | { s: 'pick'; err?: string }
  | { s: 'checking'; file: string }
  | {
      s: 'review';
      file: string;
      rows: Record<string, string>[];
      report: ImportReport;
      extra: string[];
    }
  | { s: 'importing' }
  | { s: 'done'; report: ImportReport };

/**
 * CSV import in three steps: choose a file (with a template to download), see what the API would
 * do with each row and which rows have problems, then import (all rows, or only the good ones).
 * Nothing is saved until the last step.
 */
export function ImportDialog({
  title,
  columns,
  example,
  templateName,
  run,
  onClose,
  onDone,
}: {
  title: string;
  columns: ImportColumn[];
  example: string[];
  templateName: string;
  run: ImportRun;
  onClose: () => void;
  onDone?: (r: ImportReport) => void;
}) {
  const t = useTranslations('common.data.import');
  const [step, setStep] = useState<Step>({ s: 'pick' });
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const busy = step.s === 'checking' || step.s === 'importing';

  const read = async (file: File) => {
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
      return setStep({ s: 'pick', err: t('errType') });
    }
    if (file.size > MAX_BYTES) return setStep({ s: 'pick', err: t('errSize') });
    const table = parseCsv(await file.text());
    const missing = columns.filter((c) => c.required && !table.headers.includes(c.name));
    if (missing.length) {
      return setStep({
        s: 'pick',
        err: t('errColumns', { cols: missing.map((c) => c.name).join(', ') }),
      });
    }
    if (!table.rows.length) return setStep({ s: 'pick', err: t('errEmpty') });
    if (table.rows.length > MAX_IMPORT_ROWS) {
      return setStep({ s: 'pick', err: t('errRows', { max: MAX_IMPORT_ROWS }) });
    }
    const known = new Set(columns.map((c) => c.name));
    const extra = table.headers.filter((h) => h && !known.has(h));
    setStep({ s: 'checking', file: file.name });
    try {
      const report = await run(table.rows, { dryRun: true, skipInvalid: false });
      setStep({ s: 'review', file: file.name, rows: table.rows, report, extra });
    } catch (e) {
      setStep({ s: 'pick', err: isApiError(e, 'FORBIDDEN') ? t('errForbidden') : t('errFailed') });
    }
  };

  const commit = async (rows: Record<string, string>[], skipInvalid: boolean) => {
    setStep({ s: 'importing' });
    try {
      const report = await run(rows, { dryRun: false, skipInvalid });
      setStep({ s: 'done', report });
      onDone?.(report);
    } catch (e) {
      setStep({ s: 'pick', err: isApiError(e, 'FORBIDDEN') ? t('errForbidden') : t('errFailed') });
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) void read(f);
  };

  return (
    <div
      className={d.scrim}
      onMouseDown={(e) => !busy && e.target === e.currentTarget && onClose()}
    >
      <div className={d.dialog} role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>

        {step.s === 'pick' && (
          <>
            <p className={d.muted}>{t('lead')}</p>
            <div
              className={cn(d.drop, drag && d.dropOn)}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
            >
              <strong>{t('dropTitle')}</strong>
              <span className={d.muted}>{t('dropHint', { max: MAX_IMPORT_ROWS })}</span>
              <button type="button" className={d.btn} onClick={() => input.current?.click()}>
                {t('choose')}
              </button>
              <input
                ref={input}
                type="file"
                accept=".csv,text/csv"
                hidden
                data-testid="import-file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void read(f);
                }}
              />
            </div>
            {step.err && (
              <p className={d.err} role="alert">
                {step.err}
              </p>
            )}
            <details className={d.cols}>
              <summary>{t('columns')}</summary>
              <ul>
                {columns.map((c) => (
                  <li key={c.name}>
                    <code>{c.name}</code>
                    {c.required && <em>{t('required')}</em>}
                    {c.hint && <span className={d.muted}> {c.hint}</span>}
                  </li>
                ))}
              </ul>
            </details>
            <div className={d.btns}>
              <button
                type="button"
                className={d.link}
                onClick={() =>
                  saveBlob(
                    new Blob(
                      [
                        csvTemplate(
                          columns.map((c) => c.name),
                          example,
                        ),
                      ],
                      {
                        type: 'text/csv;charset=utf-8',
                      },
                    ),
                    templateName,
                  )
                }
              >
                {t('template')}
              </button>
              <span style={{ flex: 1 }} />
              <button type="button" className={d.btn} onClick={onClose}>
                {t('cancel')}
              </button>
            </div>
          </>
        )}

        {(step.s === 'checking' || step.s === 'importing') && (
          <div className={d.working} role="status">
            <span className={d.spinner} aria-hidden />
            {step.s === 'checking' ? t('checking', { file: step.file }) : t('importing')}
          </div>
        )}

        {step.s === 'review' && (
          <Review
            step={step}
            onBack={() => setStep({ s: 'pick' })}
            onCommit={(skip) => void commit(step.rows, skip)}
          />
        )}

        {step.s === 'done' && (
          <>
            <p className={d.okMsg} role="status">
              {t('doneSummary', {
                created: step.report.created,
                updated: step.report.updated,
                skipped: step.report.skipped,
              })}
            </p>
            <div className={d.btns}>
              <button type="button" className={cn(d.btn, d.primary)} onClick={onClose}>
                {t('close')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Review({
  step,
  onBack,
  onCommit,
}: {
  step: Extract<Step, { s: 'review' }>;
  onBack: () => void;
  onCommit: (skipInvalid: boolean) => void;
}) {
  const t = useTranslations('common.data.import');
  const { report, extra, file } = step;
  const badLines = new Set(report.errors.map((e) => e.line)).size;
  const good = report.total - badLines;
  return (
    <>
      <p className={d.muted}>{t('reviewLead', { file })}</p>
      <dl className={d.summary}>
        <div>
          <dt>{t('rows')}</dt>
          <dd>{report.total}</dd>
        </div>
        <div>
          <dt>{t('new')}</dt>
          <dd>{report.created}</dd>
        </div>
        <div>
          <dt>{t('updates')}</dt>
          <dd>{report.updated}</dd>
        </div>
        <div className={cn(badLines && d.bad)}>
          <dt>{t('problems')}</dt>
          <dd>{badLines}</dd>
        </div>
      </dl>
      {!!extra.length && <p className={d.muted}>{t('ignored', { cols: extra.join(', ') })}</p>}
      {!!report.errors.length && (
        <div className={d.errTable}>
          <table>
            <thead>
              <tr>
                <th>{t('line')}</th>
                <th>{t('column')}</th>
                <th>{t('problem')}</th>
              </tr>
            </thead>
            <tbody>
              {report.errors.slice(0, 200).map((e, i) => (
                <tr key={i}>
                  <td className={d.num}>{e.line}</td>
                  <td>{e.field ?? '–'}</td>
                  <td>{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.errors.length > 200 && (
            <p className={d.muted}>{t('more', { n: report.errors.length - 200 })}</p>
          )}
        </div>
      )}
      <div className={d.btns}>
        <button type="button" className={d.btn} onClick={onBack}>
          {t('another')}
        </button>
        <span style={{ flex: 1 }} />
        {badLines ? (
          <button
            type="button"
            className={cn(d.btn, d.primary)}
            disabled={!good}
            onClick={() => onCommit(true)}
          >
            {t('importGood', { n: good })}
          </button>
        ) : (
          <button type="button" className={cn(d.btn, d.primary)} onClick={() => onCommit(false)}>
            {t('importAll', { n: report.total })}
          </button>
        )}
      </div>
    </>
  );
}
