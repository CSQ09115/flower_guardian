// 生产韧性工具：错误分类、输入约束、减少动态、计时器与本地化格式化兜底。
// 只提供可复用的兜底能力，不改动任何既有中文文案、配色或功能。
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** 读取系统「减少动态效果」设置，并在设置变化或组件卸载时保持同步与清理。 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => { if (active) setReduced(!!value); })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value) => { if (active) setReduced(!!value); },
    );
    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);
  return reduced;
}

/** 验证码倒计时：卸载自动清理，重复 start 先停旧计时，避免多个 interval 叠加。 */
export function useCountdown() {
  const [remaining, setRemaining] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const start = useCallback((seconds: number) => {
    clear();
    let left = seconds;
    setRemaining(left);
    timer.current = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clear();
        setRemaining(0);
      } else {
        setRemaining(left);
      }
    }, 1000);
  }, [clear]);

  useEffect(() => clear, [clear]);
  return { remaining, start, clear };
}

/** 把任意后端/网络异常翻译为用户可读、可恢复的中文提示，不泄露原始错误。 */
export function getApiErrorMessage(error: any, fallback = '操作失败，请稍后重试'): string {
  const status = error?.response?.status ?? error?.status;
  const detail = error?.response?.data?.detail ?? error?.response?.data?.message;
  const normalize = (value: unknown): string | null => {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (Array.isArray(value)) {
      const parts = value.map(normalize).filter(Boolean) as string[];
      return parts.length ? parts.join('；') : null;
    }
    return null;
  };
  const serverMessage = normalize(detail);
  switch (status) {
    case 400: return serverMessage || '提交的信息有误，请检查后重试';
    case 401: return '登录已过期，请重新登录';
    case 403: return '当前账号没有权限执行此操作';
    case 404: return '要查看的内容不存在或已被删除';
    case 409: return serverMessage || '数据已被更新，请刷新后重试';
    case 429: return '操作太频繁，请稍后再试';
    case 500:
    case 502:
    case 503:
    case 504: return '服务暂时不可用，请稍后重试';
    default: break;
  }
  const code = String(error?.code || '');
  if (code === 'ECONNABORTED' || /timeout/i.test(String(error?.message || ''))) {
    return '网络连接超时，请检查网络后重试';
  }
  if (code === 'ERR_NETWORK' || /network/i.test(String(error?.message || ''))) {
    return '网络连接失败，请检查网络后重试';
  }
  return serverMessage || fallback;
}

const PLACEHOLDER = '—';

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// 当前产品仅面向中文市场，locale 固定为 zh-CN；扩展多语言时把 'zh-CN' 换成用户 locale。
/** 本地化日期，非法/缺失值返回占位符而非 Invalid Date。 */
export function safeFormatDate(value: unknown, options?: Intl.DateTimeFormatOptions): string {
  const d = toDate(value);
  if (!d) return PLACEHOLDER;
  try {
    return new Intl.DateTimeFormat('zh-CN', options || { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  } catch {
    return d.toLocaleDateString('zh-CN');
  }
}

/** 本地化日期时间，非法/缺失值返回占位符而非 Invalid Date。 */
export function safeFormatDateTime(value: unknown): string {
  const d = toDate(value);
  if (!d) return PLACEHOLDER;
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(d);
  } catch {
    return d.toLocaleString('zh-CN');
  }
}

/** 相对天数：未来/非法值不显示负数天数。 */
export function safeDaysSince(value: unknown): number | null {
  const d = toDate(value);
  if (!d) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  return days < 0 ? 0 : days;
}

/** 约束用户输入：去控制字符、限制长度；按码点切分以保留 emoji / CJK / ZWNJ。 */
export function safeText(value: unknown, maxLength = 200): string {
  if (typeof value !== 'string') return '';
  const chars = Array.from(value).filter((ch) => {
    const code = ch.codePointAt(0) ?? 0;
    return code >= 32 && code !== 127 && !(code >= 128 && code <= 159);
  });
  return chars.slice(0, maxLength).join('').trim();
}
