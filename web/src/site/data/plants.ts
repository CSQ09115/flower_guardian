/**
 * Marketing-page plant data, copied verbatim from `legacy/assets/app.js`
 * (`CARE` and `FINDER`). Image paths become root-absolute because the page is
 * served from `/` today and may later be served from a sub-path build.
 */

export type PlantKey = "pothos" | "monstera" | "snake" | "peace" | "aloe" | "ivy";

/** Care-card tab order, as authored in `legacy/index.html` (01–06). */
export const PLANT_KEYS: PlantKey[] = ["pothos", "monstera", "snake", "peace", "aloe", "ivy"];

export type CarePlant = {
  name: string;
  img: string;
  alt: string;
  w: number;
  h: number;
  ease: string;
  tags: string[];
  tip: string;
  light: string;
  water: string;
  place: string;
  next: string;
  warn: string;
};

export type FinderPlant = {
  name: string;
  img: string;
  alt: string;
  w: number;
  h: number;
  ease: string;
  light: string[];
  time: string[];
  reason: string;
  tags: string[];
  order: number;
};

export const CARE: Record<PlantKey, CarePlant> = {
  pothos: {
    name: "绿萝",
    img: "/assets/pothos.jpg",
    alt: "窗台上的一盆绿萝",
    w: 1200,
    h: 750,
    ease: "容易",
    tags: ["半阴", "微湿", "避免直射"],
    tip: "喜阴凉湿润，避免直射，保持土壤微湿。",
    light: "半阴",
    water: "微湿",
    place: "避免直射",
    next: "表土干了再浇",
    warn: "浇水太勤，盆土长期不干。",
  },
  monstera: {
    name: "龟背竹",
    img: "/assets/monstera.jpg",
    alt: "龟背竹的裂叶",
    w: 1600,
    h: 1200,
    ease: "中等",
    tags: ["半阴", "微湿", "温暖"],
    tip: "喜温暖湿润，半阴环境，保持土壤微湿。",
    light: "半阴",
    water: "微湿",
    place: "温暖、避开直射",
    next: "表土干了再浇",
    warn: "光照太强会晒伤叶面，盆土长期积水会烂根。",
  },
  snake: {
    name: "虎皮兰",
    img: "/assets/snake.jpg",
    alt: "虎皮兰叶片上的斑纹",
    w: 1600,
    h: 1066,
    ease: "很容易",
    tags: ["喜阳", "耐旱", "见干见湿"],
    tip: "喜阳光充足，耐旱，浇水见干见湿。",
    light: "喜阳，也耐阴",
    water: "耐旱",
    place: "窗边或明亮处",
    next: "盆土完全干透再浇",
    warn: "浇水过多，根茎先烂。",
  },
  peace: {
    name: "白掌",
    img: "/assets/peace-lily.jpg",
    alt: "白掌的白色花苞",
    w: 1600,
    h: 1295,
    ease: "中等",
    tags: ["半阴", "湿润", "温暖"],
    tip: "喜温暖湿润，半阴环境，保持土壤湿润。",
    light: "半阴",
    water: "湿润",
    place: "温暖、避开直射",
    next: "表土干了再浇",
    warn: "缺水或空气太干，花苞容易发黄。",
  },
  aloe: {
    name: "芦荟",
    img: "/assets/aloe.jpg",
    alt: "陶盆里的芦荟",
    w: 1600,
    h: 1200,
    ease: "容易",
    tags: ["喜阳", "耐旱", "见干见湿"],
    tip: "喜阳光充足，耐旱，浇水见干见湿。",
    light: "喜阳",
    water: "耐旱",
    place: "光照充足的窗台",
    next: "盆土完全干透再浇",
    warn: "浇水过勤，叶片会化水。",
  },
  ivy: {
    name: "常春藤",
    img: "/assets/ivy.jpg",
    alt: "常春藤的叶子与墙上的影子",
    w: 1200,
    h: 1600,
    ease: "中等",
    tags: ["半阴", "湿润", "凉爽"],
    tip: "喜凉爽湿润，半阴环境，保持土壤湿润。",
    light: "半阴",
    water: "湿润",
    place: "凉爽通风处",
    next: "表土干了再浇",
    warn: "闷热不通风，容易招红蜘蛛。",
  },
};

export const FINDER: Record<PlantKey, FinderPlant> = {
  pothos: {
    name: "绿萝",
    img: "/assets/pothos.jpg",
    alt: "窗台上的一盆绿萝",
    w: 1200,
    h: 750,
    ease: "容易",
    light: ["low", "soft"],
    time: ["often", "sometimes"],
    reason: "耐阴，土干了再浇，出差一周也扛得住。",
    tags: ["半阴", "微湿", "避免直射"],
    order: 1,
  },
  snake: {
    name: "虎皮兰",
    img: "/assets/snake.jpg",
    alt: "虎皮兰叶片上的斑纹",
    w: 1600,
    h: 1066,
    ease: "很容易",
    light: ["low", "soft", "bright"],
    time: ["often"],
    reason: "耐旱也耐阴，盆土干透再浇，最适合总忘记浇水的人。",
    tags: ["喜阳", "耐旱", "见干见湿"],
    order: 2,
  },
  aloe: {
    name: "芦荟",
    img: "/assets/aloe.jpg",
    alt: "陶盆里的芦荟",
    w: 1600,
    h: 1200,
    ease: "容易",
    light: ["bright"],
    time: ["often", "sometimes"],
    reason: "喜欢直射光，宁干勿湿，窗台党友好。",
    tags: ["喜阳", "耐旱", "见干见湿"],
    order: 3,
  },
  peace: {
    name: "白掌",
    img: "/assets/peace-lily.jpg",
    alt: "白掌的白色花苞",
    w: 1600,
    h: 1295,
    ease: "中等",
    light: ["soft"],
    time: ["home", "sometimes"],
    reason: "散光下长得好，土表一干就浇，适合愿意常看一眼的人。",
    tags: ["半阴", "湿润", "温暖"],
    order: 4,
  },
  monstera: {
    name: "龟背竹",
    img: "/assets/monstera.jpg",
    alt: "龟背竹的裂叶",
    w: 1600,
    h: 1200,
    ease: "中等",
    light: ["soft"],
    time: ["home"],
    reason: "散光、温暖、微湿，长大以后很有存在感。",
    tags: ["半阴", "微湿", "温暖"],
    order: 5,
  },
  ivy: {
    name: "常春藤",
    img: "/assets/ivy.jpg",
    alt: "常春藤的叶子与墙上的影子",
    w: 1200,
    h: 1600,
    ease: "中等",
    light: ["soft", "low"],
    time: ["home", "sometimes"],
    reason: "喜欢凉爽通风，散光环境，别放在暖气边。",
    tags: ["半阴", "湿润", "凉爽"],
    order: 6,
  },
};