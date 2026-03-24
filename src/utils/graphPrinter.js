export function printGraph(node, prefix = "", isLast = true) {
  const connector = prefix ? (isLast ? "\\-- " : "|-- ") : "";

  console.log(prefix + connector + node.name);

  if (node.circular) {
    console.log(prefix + (isLast ? "    " : "|   ") + "[circular dependency]");
    return;
  }

  if (!node.dependencies || node.dependencies.length === 0) return;

  const newPrefix = prefix + (isLast ? "    " : "|   ");

  node.dependencies.forEach((dep, index) => {
    const last = index === node.dependencies.length - 1;
    printGraph(dep, newPrefix, last);
  });
}
