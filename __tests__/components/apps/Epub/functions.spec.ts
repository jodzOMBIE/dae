import { strToU8, zipSync } from "fflate";
import { parseEpub } from "components/apps/Epub/functions";

describe("parseEpub", () => {
  it("loads chapters and local assets while removing executable content", () => {
    const epub = Buffer.from(
      zipSync({
        "META-INF/container.xml": strToU8(
          '<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>'
        ),
        "OEBPS/Images/cover.png": strToU8("image-data"),
        "OEBPS/Styles/book.css": strToU8(
          'h1 { background-image: url("../Images/cover.png"); }'
        ),
        "OEBPS/Text/chapter.xhtml": strToU8(
          '<html><head><title>Opening chapter</title><link rel="stylesheet" href="../Styles/book.css"/></head><body><script>bad()</script><h1>Welcome</h1><img src="../Images/cover.png" onerror="bad()"/></body></html>'
        ),
        "OEBPS/content.opf": strToU8(
          '<package xmlns:dc="http://purl.org/dc/elements/1.1/"><metadata><dc:title>Sample book</dc:title></metadata><manifest><item id="chapter" href="Text/chapter.xhtml"/><item id="style" href="Styles/book.css"/><item id="cover" href="Images/cover.png"/></manifest><spine><itemref idref="chapter"/></spine></package>'
        ),
      })
    );

    const book = parseEpub(epub);

    expect(book.title).toBe("Sample book");
    expect(book.chapters).toHaveLength(1);
    expect(book.chapters[0].title).toBe("Opening chapter");
    expect(book.chapters[0].content).toContain("<h1>Welcome</h1>");
    expect(book.chapters[0].content).not.toContain("<script>");
    expect(book.chapters[0].content).not.toContain("onerror=");
    expect(book.chapters[0].content).toContain("data:image/png;base64,");
    expect(book.chapters[0].content).toContain("data:text/css;charset=utf-8,");
  });

  it("rejects files without an EPUB container", () => {
    expect(() => parseEpub(Buffer.from("not an epub"))).toThrow();
  });
});
