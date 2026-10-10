import { basename, extname, join } from "path";
import { useCallback } from "react";
import { useFileSystem } from "contexts/fileSystem";
import { useProcesses } from "contexts/process";
import processDirectory from "contexts/process/directory";
import { useSession } from "contexts/session";
import { useProcessesRef } from "hooks/useProcessesRef";
import {
  DESKTOP_PATH,
  FOLDER_BACK_ICON,
  PROCESS_DELIMITER,
} from "utils/constants";
import { isYouTubeUrl } from "utils/functions";

type UseFile = (pid: string, icon?: string) => Promise<void>;

const NEW_TAB_URL_PATTERNS = [
  /^https?:\/\/(?:www\.)?(?:ustvnow|sudoaquarelle|rtsoft|unsplash|escapemotions)\.com(?:[/?#]|$)/i,
  /^https?:\/\/(?:www\.)?jampea\.com(?:[/?#]|$)/i,
  /^https?:\/\/a\.ocv\.me(?:[/?#]|$)/i,
  /^https?:\/\/vps\.oglo\.dev(?:[/?#]|$)/i,
  /^https?:\/\/(?:[a-z0-9-]+\.)*itch\.(?:io|zone)(?:[/?#]|$)/i,
  /^https?:\/\/(?:www\.)?(?:codepen\.io|hit-me\.media)(?:[/?#]|$)/i,
  /^https?:\/\/(?:www\.)?(?:play\.)?js13kgames\.com(?:[/?#]|$)/i,
  /^https?:\/\/meow\.tap2play\.io(?:[/?#]|$)/i,
  /^https?:\/\/quizshow\.urban-mpire\.com(?:[/?#]|$)/i,
  /^https?:\/\/(?:www\.)?(?:coolmathgames|crazygames|lexaloffle)\.com(?:[/?#]|$)/i,
] as const;

const useFile = (url: string, path: string): UseFile => {
  const { setForegroundId, updateRecentFiles } = useSession();
  const { createPath, updateFolder } = useFileSystem();
  const { minimize, open, url: setUrl } = useProcesses();
  const processesRef = useProcessesRef();

  return useCallback(
    async (pid: string, icon?: string) => {
      const {
        preferProcessIcon,
        singleton,
        icon: processIcon,
      } = processDirectory[pid] || {};
      const activePid = singleton
        ? Object.keys(processesRef.current).find(
            (id) => id === pid || id.startsWith(`${pid}${PROCESS_DELIMITER}`)
          )
        : "";
      let runUrl = url;

      if (url.startsWith("ipfs://")) {
        const { getIpfsFileName, getIpfsResource } = await import("utils/ipfs");
        const ipfsData = await getIpfsResource(url);

        runUrl = join(
          DESKTOP_PATH,
          await createPath(
            await getIpfsFileName(url, ipfsData),
            DESKTOP_PATH,
            ipfsData
          )
        );

        updateFolder(DESKTOP_PATH, basename(runUrl));
      }

      const newTabUrl =
        runUrl || (/^https?:\/\//i.test(pid) ? pid : "");

      if (NEW_TAB_URL_PATTERNS.some((pattern) => pattern.test(newTabUrl))) {
        window.open(newTabUrl, "_blank", "noopener,noreferrer");
        return;
      }

      if (activePid) {
        setUrl(activePid, runUrl);
        if (processesRef.current[activePid].minimized) minimize(activePid);
        setForegroundId(activePid);
      } else {
        open(
          pid || "OpenWith",
          { url: runUrl },
          singleton || icon === FOLDER_BACK_ICON || preferProcessIcon
            ? processIcon
            : icon
        );

        const recentUrl = runUrl || path;

        if (recentUrl && pid) {
          updateRecentFiles(
            recentUrl,
            pid,
            isYouTubeUrl(recentUrl) ? basename(path, extname(path)) : undefined
          );
        }
      }
    },
    [
      createPath,
      minimize,
      open,
      path,
      processesRef,
      setForegroundId,
      setUrl,
      updateFolder,
      updateRecentFiles,
      url,
    ]
  );
};

export default useFile;
