import { basename } from "path";
import { memo, useEffect, useState } from "react";
import { parseEpub } from "components/apps/Epub/functions";
import StyledEpub from "components/apps/Epub/StyledEpub";
import { type ComponentProcessProps } from "components/system/Apps/RenderComponent";
import useTitle from "components/system/Window/useTitle";
import { useFileSystem } from "contexts/fileSystem";
import { useProcesses } from "contexts/process";
import Button from "styles/common/Button";
import { label } from "utils/functions";

type EpubState = ReturnType<typeof parseEpub>;

const Epub: FC<ComponentProcessProps> = ({ id }) => {
  const { readFile } = useFileSystem();
  const { processes: { [id]: process } = {} } = useProcesses();
  const { prependFileToTitle } = useTitle(id);
  const { url = "" } = process || {};
  const [book, setBook] = useState<EpubState>();
  const [chapterIndex, setChapterIndex] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setBook(undefined);
    setChapterIndex(0);
    setError("");

    if (!url) {
      setLoading(false);
      prependFileToTitle("");

      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    prependFileToTitle(basename(url));
    readFile(url)
      .then((data) => parseEpub(data))
      .then((loadedBook) => {
        if (!cancelled) setBook(loadedBook);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "The EPUB could not be opened"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [prependFileToTitle, readFile, url]);

  const chapter = book?.chapters[chapterIndex];

  return (
    <StyledEpub>
      {chapter ? (
        <>
          <nav>
            <Button
              disabled={chapterIndex === 0}
              onClick={() => setChapterIndex((current) => current - 1)}
              {...label("Previous chapter")}
            >
              Previous
            </Button>
            <span>{chapter.title}</span>
            <Button
              disabled={chapterIndex === (book?.chapters.length || 1) - 1}
              onClick={() => setChapterIndex((current) => current + 1)}
              {...label("Next chapter")}
            >
              Next
            </Button>
          </nav>
          <iframe
            key={`${url}-${chapterIndex}`}
            sandbox=""
            srcDoc={chapter.content}
            title={chapter.title}
          />
        </>
      ) : (
        <div className="message">
          {loading ? "Opening eBook..." : error || "Open an EPUB file to begin"}
        </div>
      )}
    </StyledEpub>
  );
};

export default memo(Epub);
