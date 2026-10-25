import { describe, expect, it } from 'vitest';
import { detectLocale, DICTS, t } from '../../src/shared/i18n';
import { classify, F, nameImages } from '../../src/handoff/patterns';
import { detectLanguage, runHandoff, repeatNote } from '../../src/handoff/engine';
import { verifyHandoffMarkdown } from '../../src/handoff/render';
import { conversationToMarkdown } from '../../src/export/markdown';
import { conversationToTxt } from '../../src/export/txt';
import { buildDocx } from '../../src/export/docx';
import { strFromU8, unzipSync } from 'fflate';
import { conv, msg } from '../fixtures/handoff-scenarios';

const japanese = () => conv([
  msg('user', '日本語のメモアプリを作りたい。目的は会話を保存することです。既存ファイルは削除しないでください。'),
  msg('assistant', '保存機能の実装が完了しました。設定ファイルは src/settings.json です。'),
  msg('user', '保存形式はMarkdownに決定。次に、書き出し機能を追加してください。'),
  msg('assistant', '書き出し機能は未実装です。次の作業は日本語の表示確認です。'),
], '日本語テスト');

describe('Japanese localization', () => {
  it('selects Japanese for browser language tags and has every dictionary key', () => {
    expect(detectLocale('ja-JP')).toBe('ja');
    expect(detectLocale('JA')).toBe('ja');
    expect(detectLocale('en-US')).toBe('en');
    expect(detectLocale('ko-KR')).toBe('ko');
    expect(Object.keys(DICTS.ja).sort()).toEqual(Object.keys(DICTS.en).sort());
    expect(t('ja', 'result.messages', { n: 2 })).toBe('2件のメッセージ');
    expect(t('ja', 'choose.md.title', { n: 3 })).toBe('画像3枚をどう保存しますか？');
  });

  it('recognizes Japanese decisions, prohibitions and unfinished work', () => {
    expect(classify('Markdownを採用することにした。', 'user') & F.DECISION).toBeTruthy();
    expect(classify('既存ファイルを削除しないでください。', 'user') & F.PROHIBIT).toBeTruthy();
    const pending = classify('書き出し機能は未実装です。', 'assistant');
    expect(pending & F.PENDING).toBeTruthy();
    expect(pending & F.DONE).toBeFalsy();
    expect(nameImages('![例](https://example.test/example.png)', 'ja')).toContain('画像');
    expect(repeatNote(3, [1], 'ja')).toContain('3行省略');
  });

  it('creates valid condensed and sectioned Japanese handoffs while preserving the original text', () => {
    const c = japanese();
    expect(detectLanguage(c)).toBe('ja');
    for (const opts of [{}, { budgetTokens: 8000, layout: { sectionsFrom: 0, recentShare: 0.5 } }]) {
      const r = runHandoff(c, opts);
      expect(r.lang).toBe('ja');
      expect(r.markdown).toContain('AI作業引き継ぎ');
      expect(r.markdown).toContain('Markdown');
      expect(verifyHandoffMarkdown(r.markdown, 'ja').ok).toBe(true);
    }
  });

  it('keeps Japanese handoffs Japanese when one long English log is pasted', () => {
    const c = japanese();
    c.messages.push(msg('user', 'An English diagnostic log. '.repeat(1000)));
    expect(detectLanguage(c)).toBe('ja');
  });

  it('writes Japanese document headings and a Japanese Word font', async () => {
    const c = japanese();
    expect(conversationToMarkdown(c, { locale: 'ja' }).text).toContain('ユーザー');
    expect(conversationToTxt(c, 'ja').text).toContain('書き出し日時');
    const r = await buildDocx(c, { locale: 'ja', images: new Map(), exportedAt: 0 });
    const files = unzipSync(r.bytes);
    expect(strFromU8(files['word/document.xml'])).toContain('日本語テスト');
    expect(strFromU8(files['word/styles.xml'])).toContain('Yu Gothic');
  });
});
