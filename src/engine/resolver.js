// 🔽 AUTO RESOLVER ENGINE

export function resolveBestCombination(conflictResult) {
  const { commonLoaders, commonVersions } = conflictResult;

  if (commonLoaders.size === 0 || commonVersions.size === 0) {
    return null;
  }

  // 🔥 Pick best loader (simple for now: first)
  const loader = [...commonLoaders][0];

  // 🔥 Sort versions (descending)
  const sortedVersions = [...commonVersions].sort((a, b) => {
    const pa = a.split(".").map(Number);
    const pb = b.split(".").map(Number);

    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const diff = (pb[i] || 0) - (pa[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  });

  const mcVersion = sortedVersions[0];

  return {
    loader,
    mcVersion,
  };
}