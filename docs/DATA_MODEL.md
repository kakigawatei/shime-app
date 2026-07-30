# 締めアプリ データモデル設計（Firestore詳細）

親ドキュメント: [`docs/APP_DESIGN.md`](./APP_DESIGN.md)
Firebaseプロジェクト: `kakigawatei-franchise`（既存・`nagaoka-walk`と共用）
すべての新規コレクションは既存資産（`shopOwners` `crowd` `announcements` 等）との衝突を避けるため **`shime_` プレフィックス**を付ける。
REST APIベースURL: `https://firestore.googleapis.com/v1/projects/kakigawatei-franchise/databases/(default)/documents/`

---

## 1. `shime_stores`（店舗マスタ）

```
shime_stores/{storeId}
```
| フィールド | 型 | 説明 |
|---|---|---|
| name | string | 表示名（例: "柿川亭"） |
| nameShort | string | 短縮名（メッセージ文面用。例: "柿川亭"） |
| sortOrder | number | 表示順 |
| active | boolean | 有効フラグ |

初期データ（案）:
```json
// shime_stores/kakigawatei
{ "name": "柿川亭", "nameShort": "柿川亭", "sortOrder": 1, "active": true }
// shime_stores/abura_lab
{ "name": "アブララボ", "nameShort": "アブララボ", "sortOrder": 2, "active": true }
```
将来6店舗に拡張する際はここへレコードを追加するのみ。店舗IDはコード中でハードコードせず、常に`shime_stores`から取得したリストを表示に使う。

---

## 2. `shime_staff`（スタッフ名簿）

```
shime_staff/{staffId}
```
| フィールド | 型 | 説明 |
|---|---|---|
| name | string | 表示名 |
| active | boolean | 在籍フラグ（退職者はfalseにして選択肢から除外、履歴には残す） |
| sortOrder | number | 表示順 |

アカウントではなく「発注や入力の担当者ラベル」用の軽量マスタ。PINと連動しない。

---

## 3. `shime_suppliers`（業者マスタ）＋`items`サブコレクション

```
shime_suppliers/{supplierId}
shime_suppliers/{supplierId}/items/{itemId}
```

### `shime_suppliers/{supplierId}`
| フィールド | 型 | 説明 |
|---|---|---|
| name | string | 業者名（例: "めんつう"） |
| contactPerson | string | 先方担当者名（例: "佐藤卓"、任意） |
| channel | string | `"email"` \| `"sms"` \| `"line"` \| `"messenger"` |
| contact.phone | string | SMS用電話番号（E.164推奨: `+818012345678`） |
| contact.email | string | メールアドレス |
| contact.lineTarget | string | LINE遷移用の識別情報（あれば） |
| contact.messengerPsid | string | Messengerスレッド遷移用PSID（あれば） |
| greeting | string | 文面冒頭。既定 `"お世話になっております。"` |
| closing | string | 文面末尾。既定 `"お願いいたします"` |
| closingEmoji | string | 既定 `"🙇"` |
| itemJoiner | string | `"newline"`（品目ごと改行、既定）\| `"to_renketsu"`（「〜を1と」で連結） |
| cutoffNote | string | 締め時間・曜日ルールのメモ（自由記述、§8の回答待ち） |
| sortOrder | number | 表示順 |
| active | boolean | 有効フラグ |

### `shime_suppliers/{supplierId}/items/{itemId}`
| フィールド | 型 | 説明 |
|---|---|---|
| name | string | 品目名（例: "太麺"） |
| unit | string | 単位（例: "玉" "本" "ケース" "パック"） |
| allowStoreSplit | boolean | 「内◯は◯◯」の内訳入力を許可するか |
| defaultQty | number | 発注画面初期表示の数量（既定0） |
| sortOrder | number | 表示順 |
| active | boolean | 有効フラグ |
| aliases | array\<string\> | 表記ゆれ（例: "豚骨のタレ" の別名候補として "柿川亭のタレ"。§8で要確認のため暫定的に空でも可） |

サンプル:
```json
// shime_suppliers/menstu
{
  "name": "めんつう",
  "channel": "sms",
  "contact": { "phone": "" },
  "greeting": "お世話になっております。",
  "closing": "お願いいたします",
  "closingEmoji": "🙇",
  "itemJoiner": "newline",
  "sortOrder": 1,
  "active": true
}
// shime_suppliers/menstu/items/futomen
{ "name": "太麺", "unit": "玉", "allowStoreSplit": false, "defaultQty": 0, "sortOrder": 1, "active": true }
```

---

## 4. `shime_orderTemplates`（定番セット・任意機能）

```
shime_orderTemplates/{templateId}
```
| フィールド | 型 | 説明 |
|---|---|---|
| storeId | string | 対象店舗 |
| supplierId | string | 対象業者 |
| label | string | 表示名（例: "いつもの金曜セット"） |
| lines | array\<{itemId, qty, storeSplit?}\> | 定番の品目・数量 |

発注画面で「テンプレを読み込む」ボタンから一括入力できるようにする。Phase1では無くても運用可能なため優先度は低いが、データ構造だけ先に確保しておく。

---

## 5. `shime_orders`（発注1件＝1メッセージ）

```
shime_orders/{orderId}
```
| フィールド | 型 | 説明 |
|---|---|---|
| storeId | string | この発注が属する店舗（内訳があっても「主となる店舗」） |
| supplierId | string | 業者 |
| targetDate | string(YYYY-MM-DD) | お届け希望日 |
| targetDateLabel | string | 「明日金曜日」等、生成済みの表示ラベル |
| lines | array | 品目行。各要素: `{ itemId, itemName, qty, unit, storeSplit: [{storeId, qty}] \| null, freeText: boolean }` |
| messageText | string | 最終的に生成・編集された本文全文 |
| channel | string | 送信時点のチャネル（"email"\|"sms"\|"line"\|"messenger"） |
| status | string | `"draft"` → `"opened"` → `"sent"` |
| createdByStaffId | string | 作成者（`shime_staff`参照） |
| createdByName | string | 作成者表示名（非正規化・履歴表示高速化用） |
| createdAt | timestamp | |
| openedAt | timestamp\|null | 送信アプリ/リンクを開いた時刻 |
| sentAt | timestamp\|null | 「送信しました」を人が確認した時刻（またはメール自動送信の実送信時刻） |
| sentMethod | string | `"mailto"` \| `"gas_auto_email"` \| `"sms_link"` \| `"line_link"` \| `"line_copy"` \| `"messenger_copy"` |
| duplicatedFromOrderId | string\|null | 履歴からの複製元（複製機能用） |

**「同一業者・同日に店舗ごと2通」の扱い**：1回の追加操作＝1つの新規`shime_orders`ドキュメント。`storeId`が異なる2件として独立管理し、履歴上も別々の送信として表示する（実運用のSMS実例と一致）。

---

## 6. `shime_shoppingList`（買い出しチェックリスト）

```
shime_shoppingList/{listId}          // listId = "kakigawatei" | "abura_lab" | "common"
  items: array<{
    id: string,
    name: string,
    checked: boolean,
    addedByName: string,
    addedAt: timestamp,
    checkedByName: string | null,
    checkedAt: timestamp | null
  }>
```
1店舗1ドキュメント＋共通1ドキュメントのシンプル構成（買い出しリストは件数が少なく1MB上限に到達しない想定のため、サブコレクション化せず配列で十分）。運用（店舗別か共通か）は§8 質問10の回答で確定させる。

---

## 7. `shime_inventory`（Phase4・残数と適正在庫）

```
shime_inventory/{storeId}_{itemRefKey}
```
| フィールド | 型 | 説明 |
|---|---|---|
| storeId | string | |
| supplierId | string | 紐づく業者 |
| itemId | string | `shime_suppliers/{supplierId}/items/{itemId}` 参照 |
| parLevel | number | 適正在庫数 |
| currentStock | number | 直近入力された残数 |
| lastCountedAt | timestamp | |
| lastCountedByName | string | |

発注画面の数量初期値を `max(parLevel - currentStock, 0)` で自動提案（人が上書き可能）にするのがPhase4のゴール。

---

## 8. `shime_closingRecords`（Phase2〜3・日次締め記録）

```
shime_closingRecords/{storeId}_{date}     // 例: kakigawatei_2026-07-31
```
| フィールド | 型 | 説明 | joe日次シート列との対応 |
|---|---|---|---|
| storeId | string | | - |
| date | string(YYYY-MM-DD) | | 日付 |
| ticketMachineSales | number | 券売機売上 | 券売機売上 |
| ticketMachineCount | number | 券売機杯数 | 券売機杯数 |
| anydeliSales | number | anydeli売上 | anydeli売上 |
| anydeliConverted | number | anydeli換算 | anydeli換算 |
| couponCount | number | クーポン枚数 | クーポン枚数 |
| couponSales | number | クーポン売上 | クーポン売上 |
| couponConverted | number | クーポン換算 | クーポン換算 |
| mailOrderOther | number | 通販その他 | 通販その他 |
| salesTotal | number | 売上合計（自動計算 or 手入力照合） | 売上合計 |
| estimatedCustomers | number | 推定来店客数（＝ticketMachineCount + anydeliConverted + couponConverted、自動計算） | 推定来店客数 |
| stepStatus | map | `{ ticketMachine, anydeli, customerCheck, purchaseRecord, ordering }` それぞれ `"pending"\|"in_progress"\|"done"` | - |
| confirmedByName | string | | - |
| confirmedAt | timestamp | | - |
| syncedToSheetAt | timestamp\|null | Phase3でシート反映した時刻（未実装時はnull） | - |

**列名は`uriage-dashboard`の日次シート列定義と完全に一致させる**（Phase3で書き込み先を実装する際、変換ロジックを介さず1:1でマッピングできるようにするため）。フィールドの追加・改名はjoe側の列定義変更と必ずセットで検討する。

---

## 9. `shime_appConfig`（アプリ全体設定）

```
shime_appConfig/main
```
| フィールド | 型 | 説明 |
|---|---|---|
| sharedPin | string | 共有PIN（4〜6桁。将来店舗別PINにする場合は`pinByStore`マップへ移行） |
| featureFlags | map | `{ closingStep2Enabled: false, closingStep3Enabled: false, inventorySuggestEnabled: false }` などPhase解放フラグ |

---

## 10. Firestoreセキュリティルール（案・Phase1〜2）

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 既存コレクション（shopOwners, crowd, announcements 等）には触れない。
    // shime_ 配下のみ、匿名認証を含む「サインイン済み」なら読み書き可とする
    // （社内限定URL＋アプリ内PINゲートとの二重防御で運用する前提）。
    match /shime_{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```
Phase3で会計データの書き込みを扱うようになった段階で、`crowd.html`と同様の「店舗単位アカウント＋`shime_staffAccounts/{uid} → storeId`解決」方式に切り替え、`shime_closingRecords`や将来のシート同期トリガー用コレクションについては `request.auth.token.email == storeId + '@shops.kakigawatei... '` のような店舗スコープ制限を追加することを検討する（設計のみ・実装はPhase3で着手）。

---

## 11. 業者・品目カタログの叩き台（要masa確認）

実物SMS（`docs/reference/order_sms_hokushoku.png` / `order_sms_mentsu.png`）から読み取れた範囲の**仮データ**。そのまま初期登録データとして使えるが、§APP_DESIGN.md §8 の質問1〜3の回答で正式確定させること（特に連絡先・番号は全て未確認＝空欄）。

| 業者ID | 表示名 | チャネル | 品目（暫定） | 単位 | 内訳可否 |
|---|---|---|---|---|---|
| `menstu` | めんつう | SMS | 太麺 | 玉 | 不可 |
| | | | 細麺 | 玉 | 不可 |
| | | | 冷凍12番150g | パック | 不可 |
| | | | 冷凍16番太麺 | 玉 | 不可 |
| `hokushoku` | ホクショク（佐藤卓） | SMS | 豚骨のタレ（＝柿川亭のタレ？要確認） | 本／ケース | **可**（例：内1はアブララボ） |
| | | | メンマ | ケース | 不可 |
| | | | にんにく | （個数） | 不可 |
| `chuetsu_keiran` | 中越鶏卵 | メール | 卵（規格要確認） | （要確認） | 不可 |
| `takeuchi_farm` | 竹内農園 | LINE | 野菜（品目要確認） | （要確認） | 不可 |
| `maruyama_hosou` | マルヤマ包装 | LINE | 包装資材（品目要確認） | （要確認） | 不可 |
| `albert` | アルベル | Messenger | （品目・取扱内容とも要確認） | （要確認） | 不可 |

「冷凍◯番」は品番が複数存在する可能性が高いため、実際に発注するすべての番号・重量パターンをmasaにヒアリングして個別のカタログ行として登録する（自由入力に頼らず、誤発注を防ぐ）。
