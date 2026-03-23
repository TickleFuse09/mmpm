export function printGraph(node, indent = "") {
  console.log(indent + node.name);

  if (node.circular) {
    console.log(indent + "  ↺ circular dependency");
    return;
  }

  if (!node.dependencies || node.dependencies.length === 0) return;

  node.dependencies.forEach((dep, index) => {
    const isLast = index === node.dependencies.length - 1;

    const prefix = isLast ? "└── " : "├── ";
    const nextIndent = indent + (isLast ? "    " : "│   ");

    process.stdout.write(indent + prefix);
    printGraph(dep, nextIndent);
  });
}