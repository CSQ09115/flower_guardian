/* 护花使者 · 产品官网 v2
   Page behaviour. Icons: Reicon (MIT) via assets/icons.js. */

(function () {
  "use strict";

  var doc = document;

  /* ── icons ─────────────────────────────────────────────────── */
  doc.querySelectorAll("[data-icon]").forEach(function (slot) {
    var name = slot.getAttribute("data-icon");
    var size = Number(slot.getAttribute("data-size") || 20);
    if (window.reicon) slot.innerHTML = window.reicon(name, { size: size });
  });

  /* ── nav: scroll state + mobile menu ───────────────────────── */
  var nav = doc.querySelector(".nav");
  var menuBtn = doc.querySelector(".nav__toggle");
  var navLinks = doc.getElementById("nav");

  function onScroll() {
    if (nav) nav.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  function setMenu(open) {
    if (!menuBtn || !navLinks) return;
    navLinks.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "关闭菜单" : "打开菜单");
  }

  if (menuBtn && navLinks) {
    menuBtn.addEventListener("click", function () {
      setMenu(!navLinks.classList.contains("is-open"));
    });
    navLinks.addEventListener("click", function (event) {
      if (event.target.closest("a")) setMenu(false);
    });
    doc.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setMenu(false);
    });
    doc.addEventListener("click", function (event) {
      if (!navLinks.classList.contains("is-open")) return;
      if (navLinks.contains(event.target) || menuBtn.contains(event.target)) return;
      setMenu(false);
    });
  }

  /* ── care cards ────────────────────────────────────────────── */
  var CARE = {
    pothos: {
      name: "绿萝",
      img: "assets/pothos.jpg",
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
      warn: "浇水太勤，盆土长期不干。"
    },
    monstera: {
      name: "龟背竹",
      img: "assets/monstera.jpg",
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
      warn: "光照太强会晒伤叶面，盆土长期积水会烂根。"
    },
    snake: {
      name: "虎皮兰",
      img: "assets/snake.jpg",
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
      warn: "浇水过多，根茎先烂。"
    },
    peace: {
      name: "白掌",
      img: "assets/peace-lily.jpg",
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
      warn: "缺水或空气太干，花苞容易发黄。"
    },
    aloe: {
      name: "芦荟",
      img: "assets/aloe.jpg",
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
      warn: "浇水过勤，叶片会化水。"
    },
    ivy: {
      name: "常春藤",
      img: "assets/ivy.jpg",
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
      warn: "闷热不通风，容易招红蜘蛛。"
    }
  };

  var tabs = Array.prototype.slice.call(doc.querySelectorAll(".tab"));
  var tablist = doc.querySelector(".tabs");
  var panel = doc.getElementById("care-panel");
  var carePhoto = doc.getElementById("care-photo");
  var careName = doc.getElementById("care-name");
  var careEase = doc.getElementById("care-ease");
  var careTip = doc.getElementById("care-tip");
  var careTags = doc.getElementById("care-tags");
  var careLight = doc.getElementById("care-light");
  var careWater = doc.getElementById("care-water");
  var carePlace = doc.getElementById("care-place");
  var careNext = doc.getElementById("care-next");
  var careWarn = doc.getElementById("care-warn");

  function selectTab(btn, focus) {
    var plant = CARE[btn.getAttribute("data-plant")];
    if (!plant) return;

    tabs.forEach(function (tab) {
      var active = tab === btn;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });

    if (panel) panel.setAttribute("aria-labelledby", btn.id);

    carePhoto.src = plant.img;
    carePhoto.alt = plant.alt;
    carePhoto.width = plant.w;
    carePhoto.height = plant.h;
    careName.textContent = plant.name;
    careEase.textContent = "难度 · " + plant.ease;
    careTip.textContent = plant.tip;
    careTags.innerHTML = plant.tags.map(function (tag) {
      return "<li>" + tag + "</li>";
    }).join("");
    careLight.textContent = plant.light;
    careWater.textContent = plant.water;
    carePlace.textContent = plant.place;
    careNext.textContent = plant.next;
    careWarn.textContent = plant.warn;

    if (panel) {
      panel.classList.remove("is-switch");
      void panel.offsetWidth;
      panel.classList.add("is-switch");
    }

    if (focus) btn.focus();
  }

  tabs.forEach(function (btn) {
    btn.addEventListener("click", function () { selectTab(btn, false); });
  });

  if (tablist) {
    tablist.addEventListener("keydown", function (event) {
      var index = tabs.indexOf(doc.activeElement);
      if (index < 0) return;
      var next = null;

      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;

      if (next !== null) {
        event.preventDefault();
        selectTab(tabs[next], true);
      }
    });
  }

  /* ── newbie finder ─────────────────────────────────────────── */
  var FINDER = {
    pothos: {
      name: "绿萝",
      img: "assets/pothos.jpg",
      alt: "窗台上的一盆绿萝",
      w: 1200,
      h: 750,
      ease: "容易",
      light: ["low", "soft"],
      time: ["often", "sometimes"],
      reason: "耐阴，土干了再浇，出差一周也扛得住。",
      tags: ["半阴", "微湿", "避免直射"],
      order: 1
    },
    snake: {
      name: "虎皮兰",
      img: "assets/snake.jpg",
      alt: "虎皮兰叶片上的斑纹",
      w: 1600,
      h: 1066,
      ease: "很容易",
      light: ["low", "soft", "bright"],
      time: ["often"],
      reason: "耐旱也耐阴，盆土干透再浇，最适合总忘记浇水的人。",
      tags: ["喜阳", "耐旱", "见干见湿"],
      order: 2
    },
    aloe: {
      name: "芦荟",
      img: "assets/aloe.jpg",
      alt: "陶盆里的芦荟",
      w: 1600,
      h: 1200,
      ease: "容易",
      light: ["bright"],
      time: ["often", "sometimes"],
      reason: "喜欢直射光，宁干勿湿，窗台党友好。",
      tags: ["喜阳", "耐旱", "见干见湿"],
      order: 3
    },
    peace: {
      name: "白掌",
      img: "assets/peace-lily.jpg",
      alt: "白掌的白色花苞",
      w: 1600,
      h: 1295,
      ease: "中等",
      light: ["soft"],
      time: ["home", "sometimes"],
      reason: "散光下长得好，土表一干就浇，适合愿意常看一眼的人。",
      tags: ["半阴", "湿润", "温暖"],
      order: 4
    },
    monstera: {
      name: "龟背竹",
      img: "assets/monstera.jpg",
      alt: "龟背竹的裂叶",
      w: 1600,
      h: 1200,
      ease: "中等",
      light: ["soft"],
      time: ["home"],
      reason: "散光、温暖、微湿，长大以后很有存在感。",
      tags: ["半阴", "微湿", "温暖"],
      order: 5
    },
    ivy: {
      name: "常春藤",
      img: "assets/ivy.jpg",
      alt: "常春藤的叶子与墙上的影子",
      w: 1200,
      h: 1600,
      ease: "中等",
      light: ["soft", "low"],
      time: ["home", "sometimes"],
      reason: "喜欢凉爽通风，散光环境，别放在暖气边。",
      tags: ["半阴", "湿润", "凉爽"],
      order: 6
    }
  };

  var finder = doc.getElementById("finder-app");
  var finderSteps = finder ? Array.prototype.slice.call(finder.querySelectorAll(".finder__step")) : [];
  var finderResult = doc.getElementById("finder-result");
  var finderStepLabel = doc.getElementById("finder-step");
  var finderProgress = doc.getElementById("finder-progress");
  var finderHint = doc.getElementById("finder-hint");
  var finderAnswers = {};
  var finderBusy = false;
  var finderKeys = ["light", "time", "pets"];

  function setFinderStep(index) {
    finderSteps.forEach(function (step, i) {
      var active = i === index;
      step.classList.toggle("is-active", active);
      step.hidden = !active;
    });
    if (finderResult) finderResult.hidden = true;
    if (finderHint) finderHint.hidden = false;
    if (finderStepLabel) finderStepLabel.textContent = (index + 1) + " / 3";
    if (finderProgress) finderProgress.style.width = (((index + 1) / 3) * 100) + "%";
  }

  function rankPlants() {
    return Object.keys(FINDER).map(function (key) {
      var plant = FINDER[key];
      var score = 0;

      if (plant.light.indexOf(finderAnswers.light) > -1) score += 3;
      else score -= 1.5;

      if (plant.time.indexOf(finderAnswers.time) > -1) score += 2.5;
      else score -= 1;

      if (finderAnswers.pets === "yes" && (key === "snake" || key === "aloe")) score += 0.5;

      return { key: key, plant: plant, score: score };
    }).sort(function (a, b) {
      return b.score - a.score || a.plant.order - b.plant.order;
    });
  }

  function showFinderResult() {
    var ranked = rankPlants();
    var top = ranked[0].plant;

    var resultImg = doc.getElementById("result-img");
    resultImg.src = top.img;
    resultImg.alt = top.alt;
    resultImg.width = top.w;
    resultImg.height = top.h;

    doc.getElementById("result-ease").textContent = "难度 · " + top.ease;
    doc.getElementById("result-name").textContent = top.name;
    doc.getElementById("result-why").textContent = top.reason;
    doc.getElementById("result-tags").innerHTML = top.tags.map(function (tag) {
      return "<li>" + tag + "</li>";
    }).join("");

    doc.getElementById("result-note").textContent = finderAnswers.pets === "yes"
      ? "你家里有猫或小孩：这几种植物的资料里都建议放高一点，别让它们啃到。推荐结果不替代兽医建议。"
      : "先从一盆开始。把它放在你每天都会经过的地方，浇水这件事才不容易忘。";

    var alts = doc.getElementById("result-alts");
    alts.innerHTML = "";

    ranked.slice(1, 3).forEach(function (item) {
      var plant = item.plant;
      var row = doc.createElement("div");
      row.className = "alt";

      var img = doc.createElement("img");
      img.src = plant.img;
      img.alt = plant.alt;
      img.width = plant.w;
      img.height = plant.h;

      var text = doc.createElement("div");
      var name = doc.createElement("b");
      name.textContent = plant.name;
      var ease = doc.createElement("span");
      ease.textContent = "难度 · " + plant.ease;
      text.appendChild(name);
      text.appendChild(ease);

      var tag = doc.createElement("em");
      tag.textContent = "备选";

      row.appendChild(img);
      row.appendChild(text);
      row.appendChild(tag);
      alts.appendChild(row);
    });

    finderSteps.forEach(function (step) { step.hidden = true; });
    if (finderHint) finderHint.hidden = true;
    finderResult.hidden = false;
    if (finderStepLabel) finderStepLabel.textContent = "3 / 3";
    if (finderProgress) finderProgress.style.width = "100%";
  }

  finderSteps.forEach(function (step, index) {
    step.querySelectorAll(".opt").forEach(function (option) {
      option.addEventListener("click", function () {
        if (finderBusy) return;
        finderBusy = true;

        step.querySelectorAll(".opt").forEach(function (item) {
          item.classList.remove("is-picked");
        });
        option.classList.add("is-picked");
        finderAnswers[finderKeys[index]] = option.getAttribute("data-value");

        window.setTimeout(function () {
          finderBusy = false;
          if (index < finderSteps.length - 1) setFinderStep(index + 1);
          else showFinderResult();
        }, 170);
      });
    });
  });

  var restart = doc.getElementById("finder-restart");
  if (restart) {
    restart.addEventListener("click", function () {
      finderAnswers = {};
      finderBusy = false;
      finderSteps.forEach(function (step) {
        step.querySelectorAll(".opt").forEach(function (item) {
          item.classList.remove("is-picked");
        });
      });
      setFinderStep(0);
    });
  }

  /* ── beta form → copy application text ─────────────────────── */
  var form = doc.getElementById("setup-form");
  var submit = doc.getElementById("beta-submit");
  var note = doc.getElementById("beta-note");
  var status = doc.getElementById("beta-status");
  var nickname = doc.getElementById("plant-nickname");
  var system = doc.getElementById("plant-os");
  var noteText = note ? note.textContent : "";
  var resetTimer = 0;
  var manual = null;

  function applicationText() {
    var name = (nickname && nickname.value.trim()) || "我的第一盆植物";
    var picked = form.querySelector('input[name="place"]:checked');
    var place = picked ? picked.value : "南阳台";
    var os = system ? system.value : "都行";

    return "护花使者内测申请\n植物：" + name + "\n摆放位置：" + place + "\n想装的系统：" + os;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }

    return new Promise(function (resolve, reject) {
      var area = doc.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.top = "-200px";
      doc.body.appendChild(area);
      area.select();

      var ok = false;
      try { ok = doc.execCommand("copy"); } catch (error) { ok = false; }

      doc.body.removeChild(area);
      if (ok) resolve();
      else reject(new Error("copy blocked"));
    });
  }

  function say(message) {
    if (!note) return;
    note.textContent = message;
    window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(function () { note.textContent = noteText; }, 4000);
  }

  function setLabel(text) {
    var label = submit.querySelector(".btn__text");
    if (label) label.textContent = text;
  }

  // Browsers that refuse clipboard access get a selectable box instead of a dead button.
  function showManual(text) {
    if (!manual) {
      manual = doc.createElement("textarea");
      manual.id = "beta-manual";
      manual.setAttribute("readonly", "");
      manual.rows = 4;
      manual.className = "setup__manual";
      form.insertBefore(manual, submit);
    }

    manual.value = text;
    manual.focus();
    manual.select();
    if (status) status.textContent = "浏览器不允许自动复制，申请内容已选中，请手动复制。";
  }

  if (form && submit) {
    submit.addEventListener("click", function () {
      var text = applicationText();

      copyText(text).then(function () {
        submit.classList.add("is-copied");
        setLabel("已复制");
        say("已复制。粘到邮件或聊天窗口发给我们即可。");
        if (status) status.textContent = "申请内容已复制到剪贴板。";
        window.setTimeout(function () {
          submit.classList.remove("is-copied");
          setLabel("复制申请内容");
        }, 2600);
      }).catch(function () {
        say("复制没成功，下面是申请内容，手动复制一下。");
        showManual(text);
      });
    });

    form.addEventListener("submit", function (event) { event.preventDefault(); });
  }

  /* ── section entrances ─────────────────────────────────────── */
  var reveals = doc.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var scope = el.closest("section, footer") || doc.body;
        var group = Array.prototype.slice.call(scope.querySelectorAll(".reveal"));
        var index = Math.max(0, group.indexOf(el));
        el.style.transitionDelay = Math.min(index * 55, 260) + "ms";
        el.classList.add("in");
        observer.unobserve(el);
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.08 });

    reveals.forEach(function (el) { observer.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }
})();
