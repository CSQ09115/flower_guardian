import { describe, it, expect } from "vitest";
import {
  clamp,
  compactMoney,
  dateTime,
  dayKey,
  esc,
  money,
  num,
  pad,
  pct,
  relative,
  seeded,
  sum,
  toCsv,
  DEVICE_STATE,
  STATUS_LABEL,
} from "./util";

describe("money / compactMoney / num", () => {
  it("keeps the legacy zh-CN money format", () => {
    expect(money(2333.7)).toBe("¥2,333.70");
    expect(money(0)).toBe("¥0.00");
    expect(money(1234567.891)).toBe("¥1,234,567.89");
  });

  it("compacts only above the 万 / M thresholds", () => {
    expect(compactMoney(2333.7)).toBe("¥2,333.70");
    expect(compactMoney(12345)).toBe("¥1.2万");
    expect(compactMoney(1234567)).toBe("¥1.23M");
    expect(compactMoney(9999)).toBe("¥9,999.00");
  });

  it("formats integers with zh-CN grouping", () => {
    expect(num(2333.7)).toBe("2,334");
    expect(num(21)).toBe("21");
    expect(num(2333.7, 2)).toBe("2,333.70");
    expect(pct(42.5)).toBe("43%");
    // `toFixed` follows IEEE-754: 42.55 is stored as 42.54999…, so it rounds down.
    expect(pct(42.55, 1)).toBe("42.5%");
    expect(pct(42.4, 1)).toBe("42.4%");
  });
});

describe("dayKey / pad / dateTime", () => {
  it("zero-pads day keys", () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(dayKey(new Date(2026, 10, 20))).toBe("2026-11-20");
    expect(dayKey(new Date(2026, 8, 9))).toBe("2026-09-09");
  });

  it("zero-pads single digits", () => {
    expect(pad(0)).toBe("00");
    expect(pad(7)).toBe("07");
    expect(pad(12)).toBe("12");
  });

  it("formats timestamps as YYYY-MM-DD HH:mm", () => {
    expect(dateTime(new Date(2026, 10, 20, 14, 5))).toBe("2026-11-20 14:05");
    expect(dateTime("2026-11-20T06:05:00.000Z")).toBe(dateTime(new Date("2026-11-20T06:05:00.000Z")));
    expect(dateTime("")).toBe("—");
    expect(dateTime("not-a-date")).toBe("—");
  });
});

describe("relative", () => {
  const now = new Date(2026, 10, 20, 12, 0, 0).getTime();

  it("reproduces the legacy Chinese wording", () => {
    expect(relative(new Date(now - 5 * 1000), now)).toBe("刚刚");
    expect(relative(new Date(now - 30 * 1000), now)).toBe("30 秒前");
    expect(relative(new Date(now - 3 * 60 * 1000), now)).toBe("3 分钟前");
    expect(relative(new Date(now - 5 * 3600 * 1000), now)).toBe("5 小时前");
    expect(relative(new Date(now - 3 * 86400 * 1000), now)).toBe("3 天前");
    expect(relative(new Date(now - 90 * 86400 * 1000), now)).toBe(dateTime(new Date(now - 90 * 86400 * 1000)));
    expect(relative("", now)).toBe("—");
  });
});

describe("seeded", () => {
  it("matches the legacy generator's first values", () => {
    const rnd = seeded(20261115);
    expect(rnd()).toBe(0.27313731564208865);
    expect(rnd()).toBe(0.8030025872867554);
    expect(rnd()).toBe(0.08663179608993232);
  });

  it("is deterministic for the same seed", () => {
    const a = seeded(42);
    const b = seeded(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("clamp / sum / esc", () => {
  it("clamps to the given range", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it("sums lists with and without a picker", () => {
    expect(sum([1, 2, 3])).toBe(6);
    expect(sum([{ v: 1 }, { v: 2 }], (x) => x.v)).toBe(3);
    expect(sum([])).toBe(0);
  });

  it("escapes HTML entities", () => {
    expect(esc('<a href="x">&\'</a>')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
    expect(esc(null)).toBe("");
    expect(esc(12)).toBe("12");
  });
});

describe("toCsv", () => {
  it("quotes cells that contain a comma, a quote or a newline", () => {
    expect(toCsv([["a", "b"], ["1", "2"]])).toBe("a,b\r\n1,2");
    expect(toCsv([["a,b", 'c"d'], ["e\nf", null]])).toBe('"a,b","c""d"\r\n"e\nf",');
  });
});

describe("labels", () => {
  it("keeps the legacy status and device wording", () => {
    expect(STATUS_LABEL).toEqual({
      pending: "待确认",
      confirmed: "已确认",
      shipped: "已发货",
      completed: "已完成",
      cancelled: "已取消",
    });
    expect(DEVICE_STATE).toEqual({
      online: { label: "在线", tone: "ok" },
      offline: { label: "离线", tone: "plain" },
      alarm: { label: "告警", tone: "danger" },
    });
  });
});
