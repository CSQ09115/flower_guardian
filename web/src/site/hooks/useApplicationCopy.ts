import { useCallback, useEffect, useRef, useState } from "react";

const NOTE_TEXT = "点一下复制申请内容，粘到邮件或聊天窗口发给我们即可。";

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise<void>((resolve, reject) => {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-200px";
    document.body.appendChild(area);
    area.select();

    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }

    document.body.removeChild(area);
    if (ok) resolve();
    else reject(new Error("copy blocked"));
  });
}

/**
 * Beta application form, ported from the copy block of `legacy/assets/app.js`:
 * the same text layout, the same 2.6s 「已复制」 state, the same 4s note reset
 * and the same read-only textarea fallback when the clipboard is unavailable.
 */
export function useApplicationCopy(): {
  nickname: string;
  setNickname: (value: string) => void;
  place: string;
  setPlace: (value: string) => void;
  os: string;
  setOs: (value: string) => void;
  copied: boolean;
  note: string;
  manualText: string | null;
  status: string;
  submit: () => Promise<void>;
} {
  const [nickname, setNickname] = useState("窗台上的绿萝");
  const [place, setPlace] = useState("南阳台");
  const [os, setOs] = useState("iOS");
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState(NOTE_TEXT);
  const [manualText, setManualText] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  const say = useCallback((message: string): void => {
    setNote(message);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setNote(NOTE_TEXT), 4000);
  }, []);

  const submit = useCallback(async (): Promise<void> => {
    const name = nickname.trim() || "我的第一盆植物";
    const text = `护花使者内测申请\n植物：${name}\n摆放位置：${place}\n想装的系统：${os}`;

    try {
      await copyText(text);
      setCopied(true);
      say("已复制。粘到邮件或聊天窗口发给我们即可。");
      setStatus("申请内容已复制到剪贴板。");
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2600);
    } catch {
      say("复制没成功，下面是申请内容，手动复制一下。");
      setManualText(text);
      setStatus("浏览器不允许自动复制，申请内容已选中，请手动复制。");
    }
  }, [nickname, os, place, say]);

  return { nickname, setNickname, place, setPlace, os, setOs, copied, note, manualText, status, submit };
}