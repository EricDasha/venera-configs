class ManWaBa extends ComicSource {
  name = "漫蛙吧";
  key = "manwaba";
  version = "2.0.0";
  minAppVersion = "1.4.0";
  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/manwaba.js";

  baseUrl = "https://manwame.com";
  aesKey = "355626526f52254a6640704a50796446";

  parseMangaCard(card) {
    let link = card.querySelector("a.manga-cover") || card.querySelector("a");
    let href = link.attributes["href"];
    let id = href.split("/").pop();
    let img = link.querySelector("img");
    let title = img ? (img.attributes["alt"] || "") : "";
    let cover = img ? img.attributes["src"] : "";
    return new Comic({
      id: id,
      title: title,
      cover: cover,
    });
  }

  async decryptParams(params) {
    let keyHex = this.aesKey;
    let keyBytes = new Uint8Array(keyHex.length / 2);
    for (let i = 0; i < keyHex.length; i += 2) {
      keyBytes[i / 2] = parseInt(keyHex.substr(i, 2), 16);
    }
    let key = keyBytes.buffer;
    let decoded = await Convert.decodeBase64(params);
    let allBytes = new Uint8Array(decoded);
    let iv = allBytes.slice(0, 16).buffer;
    let ciphertext = allBytes.slice(16).buffer;
    let decrypted = await Convert.decryptAesCbc(ciphertext, key, iv);
    let jsonStr = await Convert.decodeUtf8(decrypted);
    return JSON.parse(jsonStr);
  }

  explore = [
    {
      title: this.name,
      type: "singlePageWithMultiPart",
      load: async (page) => {
        let res = await Network.get(this.baseUrl);
        if (res.status !== 200) {
          throw "Invalid status code: " + res.status;
        }
        let document = new HtmlDocument(res.body);
        let result = {};

        let heroComics = document
          .querySelectorAll(".hero-panel")
          .map((e) => {
            let href = e.attributes["href"];
            let id = href.split("/").pop();
            let img = e.querySelector("img");
            let title = img ? (img.attributes["alt"] || "") : "";
            let cover = img ? img.attributes["src"] : "";
            let em = e.querySelector("em");
            let subTitle = em ? em.text.trim() : "";
            return new Comic({ id: id, title: title, cover: cover, subTitle: subTitle });
          });
        if (heroComics.length > 0) {
          result["热门推荐"] = heroComics;
        }

        let sections = document.querySelectorAll("section.content-section");
        for (let section of sections) {
          let titleEl = section.querySelector("h2");
          if (!titleEl) continue;
          let sectionTitle = titleEl.text.trim();
          let cards = section.querySelectorAll("article.manga-card");
          if (cards.length === 0) continue;
          let comics = cards.map((e) => this.parseMangaCard(e));
          if (comics.length > 0) {
            result[sectionTitle] = comics;
          }
        }

        return result;
      },
    },
  ];

  category = {
    title: this.name,
    parts: [
      {
        name: "题材",
        type: "fixed",
        categories: [
          "全部", "玄幻", "搞笑", "格斗", "热血", "古风", "冒险",
          "悬疑", "都市", "恋爱", "复仇", "科幻", "魔幻", "穿越",
          "奇幻", "其他", "战斗", "生活", "少女", "百合", "全彩",
          "校园", "爱情", "橘味", "剧情", "推理", "大女主", "腹黑",
          "惊悚", "治愈", "逆袭", "总裁", "日常", "动作", "恐怖",
          "重生", "后宫", "女仆", "纯情", "霸总", "非现代", "纯爱",
          "少男", "新作", "萌系", "游戏", "偶像", "青春", "浪漫",
        ],
        itemType: "category",
        categoryParams: [
          "", "xuanhuan", "gaoxiao", "gedou", "rexue", "gufeng", "maoxian",
          "xuanyi", "dushi", "lianai", "fuchou", "kehuan", "mohuan", "chuanyue",
          "qihuan", "qita", "zhandou", "shenghuo", "shaonv", "baihe", "quancai",
          "xiaoyuan", "aiqing", "juwei", "juqing", "tuili", "danvzhu", "fuhei",
          "jingsong", "zhiyu", "nixi", "zongcai", "richang", "dongzuo", "kongbu",
          "zhongsheng", "hougong", "nvpu", "chunqing", "bazong", "feixiandai", "chunai",
          "shaonan", "xinzuo", "mengxi", "youxi", "ouxiang", "qingchun", "langman",
        ],
      },
    ],
    enableRankingPage: false,
  };

  categoryComics = {
    load: async (category, param, options, page) => {
      let url = this.baseUrl + "/category";
      if (param) {
        url += "/theme/" + param;
      }
      if (page > 1) {
        url += "/page/" + page;
      }
      let res = await Network.get(url);
      if (res.status !== 200) {
        throw "Invalid status code: " + res.status;
      }
      let document = new HtmlDocument(res.body);
      let cards = document.querySelectorAll("article.manga-card");
      let comics = cards.map((e) => this.parseMangaCard(e));

      let maxPage = page;
      let pageLinks = document.querySelectorAll("a[href*='/page/']");
      for (let link of pageLinks) {
        let href = link.attributes["href"];
        let match = href.match(/\/page\/(\d+)/);
        if (match) {
          let num = parseInt(match[1]);
          if (num > maxPage) {
            maxPage = num;
          }
        }
      }

      return { comics: comics, maxPage: maxPage };
    },
    optionList: [],
  };

  search = {
    load: async (keyword, options, page) => {
      let url = this.baseUrl + "/search?q=" + encodeURIComponent(keyword);
      let res = await Network.get(url);
      if (res.status !== 200) {
        throw "Invalid status code: " + res.status;
      }
      let document = new HtmlDocument(res.body);
      let cards = document.querySelectorAll("article.manga-card");
      let comics = cards.map((e) => this.parseMangaCard(e));
      return { comics: comics, maxPage: 1 };
    },
    optionList: [],
  };

  comic = {
    loadInfo: async (id) => {
      let url = this.baseUrl + "/book/" + id;
      let res = await Network.get(url);
      if (res.status !== 200) {
        throw "Invalid status code: " + res.status;
      }
      let document = new HtmlDocument(res.body);

      let title = document.querySelector(".profile-text h1").text.trim();
      let cover = document.querySelector(".profile-cover img").attributes["src"];

      let author = "";
      let status = "";
      let updateTime = "";
      let paragraphs = document.querySelectorAll(".profile-text p");
      for (let p of paragraphs) {
        let text = p.text.trim();
        if (text.startsWith("作者：")) {
          author = text.replace("作者：", "").trim();
        } else if (text.startsWith("状态：")) {
          status = text.replace("状态：", "").trim();
        } else if (text.startsWith("更新：")) {
          updateTime = text.replace("更新：", "").trim();
        }
      }

      let tags = document
        .querySelectorAll(".tag-strip a")
        .map((e) => e.text.trim());

      let description = "";
      let descEl = document.querySelector(".intro-text");
      if (descEl) {
        description = descEl.text.trim();
      }

      let chapters = new Map();
      let chapterLinks = document.querySelectorAll("[data-chapter-list] a");
      for (let link of chapterLinks) {
        let href = link.attributes["href"];
        let epId = href.split("/").pop().replace(".html", "");
        let epTitle = link.text.trim();
        chapters.set(epId, epTitle);
      }

      let recommend = [];
      let recommendCards = document.querySelectorAll(
        ".manga-grid article.manga-card"
      );
      for (let card of recommendCards) {
        let link = card.querySelector("a.manga-cover") || card.querySelector("a");
        if (!link) continue;
        let href = link.attributes["href"];
        let recId = href.split("/").pop();
        let img = link.querySelector("img");
        let recTitle = img ? (img.attributes["alt"] || "") : "";
        let recCover = img ? img.attributes["src"] : "";
        recommend.push({ id: recId, title: recTitle, cover: recCover });
      }

      return new ComicDetails({
        title: title,
        cover: cover,
        description: description,
        tags: {
          作者: [author],
          标签: tags,
          状态: [status],
        },
        chapters: chapters,
        recommend: recommend,
        updateTime: updateTime,
      });
    },

    loadEp: async (comicId, epId) => {
      let url = this.baseUrl + "/book/" + comicId + "/" + epId + ".html";
      let res = await Network.get(url);
      if (res.status !== 200) {
        throw "Invalid status code: " + res.status;
      }

      let paramsMatch = res.body.match(/params\s*=\s*'([^']+)'/);
      if (!paramsMatch) {
        throw "Failed to extract params from chapter page";
      }
      let params = paramsMatch[1];

      let decrypted = await this.decryptParams(params);

      let host = "";
      if (decrypted.images_hosts && decrypted.images_hosts.length > 0) {
        host = decrypted.images_hosts[0];
      } else if (decrypted.images_domain) {
        host = decrypted.images_domain;
      } else if (decrypted.cdnurl) {
        host = decrypted.cdnurl;
      }
      if (!host) {
        throw "No image host found";
      }

      let images = decrypted.chapter_images.map((path) => {
        if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(path)) {
          return path;
        }
        return host.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
      });

      return { images: images };
    },

    onImageLoad: (url, comicId, epId) => {
      return {
        url: url,
        headers: {
          referer: this.baseUrl + "/",
        },
      };
    },
  };
}
