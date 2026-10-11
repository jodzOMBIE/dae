import { posix } from "path";
import { strFromU8, unzipSync } from "fflate";

type EpubChapter = {
  content: string;
  title: string;
};

type EpubBook = {
  chapters: EpubChapter[];
  title: string;
};

const MIME_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".css": "text/css",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const decodeXml = (value: Uint8Array, fileName: string): Document => {
  const document = new DOMParser().parseFromString(
    strFromU8(value),
    "application/xml"
  );

  if (document.querySelector("parsererror")) {
    throw new Error(`The EPUB contains invalid XML in ${fileName}`);
  }

  return document;
};

const getXmlElement = (
  document: Document,
  localName: string
): Element | undefined =>
  [...document.querySelectorAll("*")].find(
    (element) => element.localName === localName
  );

const getArchivePath = (basePath: string, href: string): string => {
  const localPath = href.split(/[?#]/, 1)[0];

  return posix
    .normalize(posix.join(basePath, decodeURIComponent(localPath)))
    .replace(/^\/+/, "");
};

const getResourceUrl = (
  archive: ReturnType<typeof unzipSync>,
  basePath: string,
  href: string
): string => {
  if (/^(?:data:|#)/i.test(href)) return href;

  const resourcePath = getArchivePath(basePath, href);
  const resource = archive[resourcePath];

  if (!resource) return "";

  const extension = posix.extname(resourcePath).toLowerCase();
  const mimeType = MIME_TYPES[extension] || "application/octet-stream";

  return `data:${mimeType};base64,${Buffer.from(resource).toString("base64")}`;
};

const localizeCss = (
  css: string,
  archive: ReturnType<typeof unzipSync>,
  basePath: string
): string =>
  css
    .replace(/@import\s[^;]+;?/gi, "")
    .replace(/url\(([^)]*)\)/gi, (_match, value: string) => {
      const href = value.trim().replace(/^["']|["']$/g, "");
      const resourceUrl = getResourceUrl(archive, basePath, href);

      return resourceUrl ? `url("${resourceUrl}")` : "url('')";
    });

const createChapterDocument = (
  source: string,
  chapterPath: string,
  archive: ReturnType<typeof unzipSync>
): EpubChapter => {
  const document = new DOMParser().parseFromString(source, "text/html");
  const basePath = posix.dirname(chapterPath);

  document
    .querySelectorAll("script, iframe, object, embed, form, base")
    .forEach((element) => element.remove());

  document.querySelectorAll("*").forEach((element) => {
    [...element.attributes].forEach(({ name, value }) => {
      if (/^on/i.test(name)) {
        element.removeAttribute(name);
      } else if (name === "style") {
        element.setAttribute(name, localizeCss(value, archive, basePath));
      } else if (["src", "poster"].includes(name)) {
        const resourceUrl = getResourceUrl(archive, basePath, value);

        if (resourceUrl) element.setAttribute(name, resourceUrl);
        else element.removeAttribute(name);
      } else if (name === "srcset") {
        element.removeAttribute(name);
      } else if (name === "href") {
        if (
          element.tagName === "LINK" &&
          element.getAttribute("rel") === "stylesheet"
        ) {
          const resourcePath = getArchivePath(basePath, value);
          const stylesheet = archive[resourcePath];

          if (stylesheet) {
            const css = localizeCss(
              strFromU8(stylesheet),
              archive,
              posix.dirname(resourcePath)
            );

            element.setAttribute(
              name,
              `data:text/css;charset=utf-8,${encodeURIComponent(css)}`
            );
          } else {
            element.remove();
          }
        } else if (!value.startsWith("#")) {
          element.setAttribute(name, "#");
        }
      }
    });
  });

  [...document.querySelectorAll("style")].forEach((styleElement) => {
    styleElement.replaceChildren(
      localizeCss(styleElement.textContent || "", archive, basePath)
    );
  });

  return {
    content: `<!doctype html>${document.documentElement.outerHTML}`,
    title: document.querySelector("title")?.textContent?.trim() || "",
  };
};

export const parseEpub = (data: Buffer): EpubBook => {
  const archive = unzipSync(data);
  const containerFile = archive["META-INF/container.xml"];

  if (!containerFile) {
    throw new Error("This file does not contain a valid EPUB container");
  }

  const container = decodeXml(containerFile, "META-INF/container.xml");
  const packagePath = getXmlElement(container, "rootfile")?.getAttribute(
    "full-path"
  );

  if (!packagePath || !archive[packagePath]) {
    throw new Error("The EPUB package document could not be found");
  }

  const packageDocument = decodeXml(archive[packagePath], packagePath);
  const manifest = new Map(
    [...packageDocument.querySelectorAll("*")]
      .filter((item) => item.localName === "item")
      .map((item) => [item.getAttribute("id"), item.getAttribute("href")])
  );
  const spine = getXmlElement(packageDocument, "spine");
  const itemRefs = spine
    ? [...spine.querySelectorAll("*")].filter(
        (item) => item.localName === "itemref"
      )
    : [];
  const contentBasePath = posix.dirname(packagePath);
  const title =
    getXmlElement(packageDocument, "title")?.textContent?.trim() || "";
  const chapters = itemRefs.flatMap((itemRef, index) => {
    const href = manifest.get(itemRef.getAttribute("idref") || "");

    if (!href) return [];

    const chapterPath = getArchivePath(contentBasePath, href);
    const chapterFile = archive[chapterPath];

    if (!chapterFile) {
      throw new Error(`The EPUB chapter could not be found: ${href}`);
    }

    const chapter = createChapterDocument(
      strFromU8(chapterFile),
      chapterPath,
      archive
    );

    return [
      {
        ...chapter,
        title: chapter.title || `Chapter ${index + 1}`,
      },
    ];
  });

  if (chapters.length === 0) {
    throw new Error("The EPUB does not contain any readable chapters");
  }

  return { chapters, title };
};
