# Lucian AI Chat Exporter 日本語版

ChatGPT・Claude・Gemini・Grokの会話を書き出したり、別のAIへ引き継ぐためのMarkdownを作るChrome拡張機能です。

この日本語版は、上流のバージョン1.3.10（コミット `f65cdc8414546754d37d0fbb692a5db70aeb4e26`）を基にした非公式の日本語対応forkです。Chromeウェブストアの公式配布版とは別に、開発者モードで読み込みます。

## インストール

1. [Releases](https://github.com/syumari/lucian-ai-chat-exporter/releases/latest)のAssetsから `lucian-ai-chat-exporter-ja-v1.3.10.zip` をダウンロードして、すべて展開します。「Source code」は開発者向けのため、通常の導入には使いません。
2. Chromeで `chrome://extensions` を開き、右上の「デベロッパー モード」をオンにします。
3. 「パッケージ化されていない拡張機能を読み込む」を選び、`manifest.json` が直接入っているフォルダーを指定します。ZIPファイルそのものは選びません。
4. 開いていたChatGPT・Claude・Gemini・Grokの会話タブを再読み込みします。
5. ツールバーのLucianアイコン、またはAIの回答の下に現れるLucianボタンから使います。

Edgeでは `edge://extensions` を開き、「開発者モード」と「展開して読み込み」を使います。今回の動作テストはChrome for Testingで行っており、Edgeでの実動作は未確認です。

読み込み後も、このフォルダーは移動・削除せず残してください。更新する場合は同じフォルダーの内容を更新し、拡張機能の管理画面で再読み込みした後、会話タブも再読み込みします。手動導入版は自動更新されません。

## 日本語化した内容

- ポップアップ、会話画面のパネル、進捗、画像の保存方法、エラー、検証結果。
- Markdown・TXT・HTML・Word・HWPXなどの文書見出し、PDFの印刷案内、検証レポート。
- AIへの引き継ぎ文書の見出しと案内、日本語会話の言語判定。
- 日本語の依頼、禁止、決定、完了、未完了、次の作業に関する基本的な抽出ルール。
- 画面用の日本語フォント候補、Wordの日本語用フォント。

画面の言語はブラウザーの表示言語に従います。日本語のブラウザーでは日本語、英語・韓国語のブラウザーでは元の対応言語で表示されます。引き継ぎ文書はユーザーの会話言語を自動判定します。会話本文や添付資料そのものを翻訳する機能ではありません。JSONのキー、ファイル名の拡張子、内部の診断コードは互換性のため維持しています。

## 使い方

「引き継ぎ用Markdownを保存」で作ったファイルを、別のAIや新しい会話に添付すると、前の会話から作業を続けられます。引き継ぎは外部AIを使わず、原文の重要な文をルールに基づいて抜粋する機能です。日本語の抽出にも基本的な判定ルールを追加していますが、内容の完全な理解や重要事項の完全な保持を保証するものではありません。

会話全体を保存する場合はMarkdown・PDF・TXTを選びます。「ほかの形式を表示」からWord・HWPX・HTML・JSON・ZIPバックアップも選べます。画像があるMarkdownでは、画像と一緒にZIPにまとめる方法がおすすめです。

PDFは印刷画面の送信先で「PDFに保存」を選んで保存します。会話はブラウザー内で処理し、書き出しのために外部のAIやPDF変換サーバーへ送ることはありません。

## 検証範囲

型チェック、Lint、単体・回帰テスト174件が成功しました。4サービスの模擬サイトを使う既存E2Eテスト11件もChrome for Testingで成功しました。日本語会話と日本語UIの追加ブラウザーテストでは、全書き出し形式、引き継ぎ、表示の文字切れを確認しています。実サービスのログイン済みアカウントでの検証は行っていません。

上流の制限は引き継ぎます。サービス側の変更により取得できなくなる場合があります。Word・HWPX・TXTでは数式がLaTeXの原文になります。Word・ハングルアプリ本体での目視確認は今回行っていません。

## ソースからのビルド

Node.js 20以上でソースフォルダーを開き、以下を実行します。

```powershell
npm ci
npm run check
npm run package
```

`dist`が読み込み用フォルダー、`release`が配布ZIPの出力先です。ソースZIPには依存パッケージ本体やテスト専用ブラウザーは含めていません。

日本語ブラウザーテストは、Chrome for Testingを用意してから次のように実行できます。

```powershell
$env:CHROME_PATH = 'C:\path\to\chrome-for-testing\chrome.exe'
npx esbuild scripts/japanese-smoke.ts --bundle --platform=node --format=esm --packages=external --outfile=dist-lab/japanese-smoke.mjs
node dist-lab/japanese-smoke.mjs
```

テスト専用プロファイルには短い一時パスを使います。Windowsでは長いプロファイルパスがIndexedDBの作成に影響することがあります。

依存関係の監査では、上流指定の開発用パッケージ`happy-dom@21.0.3`にhighの指摘が1件ありました。ビルド済み拡張には含まれません。今回の作業では依存バージョンは変更していません。

元のリポジトリ：https://github.com/Seokwoooo/lucian-ai-chat-exporter

元のMITライセンスと同梱ライブラリのライセンス表記を保持しています。
