"use client";

import type { EventRow } from "@openmatsuri/realtime/client";
import { AppShell, Button, PanelCard } from "@openmatsuri/ui";
import { setViewerLocationConsent } from "@openmatsuri/viewer-ingest";

type Props = {
  event: EventRow;
  embed?: boolean;
  onConsent: () => void;
};

export function ViewerLocationConsent({ event, embed, onConsent }: Props) {
  function handleConsent() {
    setViewerLocationConsent(event.id);
    onConsent();
  }

  const content = (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8">
      <PanelCard title="位置情報の利用について">
        <div className="space-y-4 text-sm leading-relaxed text-slate-700">
          <p>
            <strong>{event.name}</strong> のマップを利用するには、位置情報の送信についての同意が必要です。
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>匿名のセッション ID で、おおよその位置をサーバーに送信します。</li>
            <li>送信は <strong>2分ごと</strong> です。個人を特定する目的では利用しません。</li>
            <li>データは運営が <strong>混雑分布（ヒートマップ）</strong> としてのみ確認します。</li>
            <li>他の来場者にはあなたの位置は表示されません。</li>
            <li>データは最大 <strong>{event.viewer_location_retention_days ?? 365} 日</strong> 保存後に削除されます。</li>
          </ul>
          <p className="text-slate-500">
            同意しない場合、マップは表示されません。ブラウザの GPS 許可は、送信開始時に別途求められます。
          </p>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button className="flex-1" onClick={handleConsent}>
            同意してマップを表示
          </Button>
        </div>
      </PanelCard>
    </div>
  );

  if (embed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">{content}</div>
    );
  }

  return (
    <AppShell appLabel="Viewer" title={event.name} fill compact footer={false}>
      <div className="flex h-full min-h-0 items-center justify-center">{content}</div>
    </AppShell>
  );
}
