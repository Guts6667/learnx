import ts from 'typescript';

function literalModuleSpecifier(node: ts.Node): string | undefined {
  if (
    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
    node.moduleSpecifier &&
    ts.isStringLiteralLike(node.moduleSpecifier)
  ) {
    return node.moduleSpecifier.text;
  }

  if (
    ts.isImportEqualsDeclaration(node) &&
    ts.isExternalModuleReference(node.moduleReference) &&
    node.moduleReference.expression &&
    ts.isStringLiteralLike(node.moduleReference.expression)
  ) {
    return node.moduleReference.expression.text;
  }

  if (!ts.isCallExpression(node)) return undefined;
  const [argument] = node.arguments;
  if (!argument || !ts.isStringLiteralLike(argument)) return undefined;
  if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
    return argument.text;
  }
  if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
    return argument.text;
  }
  return undefined;
}

export function findModuleSpecifiers(sourceFile: ts.SourceFile): string[] {
  const specifiers = new Set<string>();

  function visit(node: ts.Node): void {
    const specifier = literalModuleSpecifier(node);
    if (specifier) specifiers.add(specifier);
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return [...specifiers];
}
